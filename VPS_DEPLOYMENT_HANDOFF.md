# ClaimVerify — VPS Deployment Handoff

> **Purpose:** This document is the complete deployment playbook for the ClaimVerify project.
> Give this file to any coding agent and tell it to deploy — it will produce the exact zip files, SCP commands, and VPS SSH commands needed, without needing to ask any questions.

---

## 1. Architecture Overview

ClaimVerify is a 3-part application:

| Component | Tech Stack | Local Path | VPS Path |
|-----------|-----------|------------|----------|
| **Backend API** | Django 6 + Django Ninja + PostgreSQL | `D:\Shoveltech\Shoveltech Internal Porject\` (root) | `~/apps/claimverify_source/` |
| **Frontend Web Portal** | React 18 + Vite + MUI 7 | `D:\Shoveltech\Shoveltech Internal Porject\frontend\` | `~/claimverify.shovelsolutions.in/` |
| **Vendor Mobile App** | React Native (Expo SDK 54) | `D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal\` | N/A (APK distributed via EAS) |

### Production URLs

| Endpoint | URL |
|----------|-----|
| API Base | `https://api.claimverify.shovelsolutions.in/api` |
| API Health Check | `https://api.claimverify.shovelsolutions.in/api/health` |
| API Docs (Swagger) | `https://api.claimverify.shovelsolutions.in/api/docs` |
| Web Portal | `https://claimverify.shovelsolutions.in` |

### VPS Credentials & Access

| Detail | Value |
|--------|-------|
| SSH User | `shovelsolutions` |
| Home Directory | `/home/shovelsolutions/` |
| Python Virtual Env | `~/virtualenvs/claimverify/` |
| Python Binary | `~/virtualenvs/claimverify/bin/python` |
| Web Server | Apache with Phusion Passenger (for Django) |
| Passenger Restart | `touch ~/apps/claimverify_source/tmp/restart.txt` |
| Database | PostgreSQL (configured via `.env` on VPS) |
| Backup Directory | `~/deployment_backups/` |
| Temp Extraction Dir | `~/tmp/` (create as needed, clean after deploy) |

---

## 2. Project Structure (Local)

```
D:\Shoveltech\Shoveltech Internal Porject\
├── .env                          # Backend env vars (local)
├── .env.example                  # Template for env vars
├── manage.py                     # Django entry point
├── requirements.txt              # Python dependencies
├── core/                         # Django project config
│   ├── settings.py               # Django settings (reads from .env)
│   ├── urls.py                   # URL routing
│   ├── api.py                    # Django Ninja API router
│   ├── media_serve.py            # Custom media serving views
│   ├── permissions.py            # Custom permission classes
│   └── wsgi.py                   # WSGI entry point (used by Passenger)
├── users/                        # Main Django app
│   ├── api/                      # API endpoint modules
│   │   ├── auth.py               # Authentication endpoints
│   │   ├── cases.py              # Case management endpoints (largest file)
│   │   ├── vendor_cases.py       # Vendor/business partner endpoints
│   │   ├── users.py              # User management endpoints
│   │   ├── vendors.py            # Vendor CRUD endpoints
│   │   ├── super_admin.py        # Super admin endpoints
│   │   ├── reports.py            # AI report generation endpoints
│   │   ├── verifications.py      # Check verification endpoints
│   │   └── notifications.py      # Push notification endpoints
│   ├── models.py                 # Django ORM models
│   ├── models_insurance.py       # Insurance-specific models
│   ├── models_verification.py    # Verification check models
│   ├── schemas.py                # Pydantic schemas for Ninja
│   ├── incident_case_db.py       # Raw SQL helpers for incident DB
│   ├── auth.py                   # Custom auth classes
│   ├── backends.py               # Custom auth backends
│   ├── services/                 # Business logic services
│   │   ├── ai_case_review_service.py
│   │   ├── speech_statement_service.py
│   │   ├── notification_service.py
│   │   ├── email_service.py
│   │   └── ...
│   └── migrations/               # Django migrations (0001–0068)
├── media/                        # Uploaded media files
├── frontend/                     # React web portal source
│   ├── .env                      # Dev env (VITE_API_BASE_URL=http://localhost:8001/api)
│   ├── .env.production           # Prod env (VITE_API_BASE_URL=https://api.claimverify.shovelsolutions.in/api)
│   ├── package.json              # NPM dependencies
│   ├── vite.config.js            # Vite config (dev proxy to :8001)
│   ├── dist/                     # Built output (this is what gets deployed)
│   └── src/                      # React source code
├── Vendor_Portal/                # Expo React Native app
│   ├── .env                      # Dev env (EXPO_PUBLIC_API_BASE_URL)
│   ├── app.json / app.config.js  # Expo config
│   └── ...
└── *.docx                        # RTO/RTI document templates
```

---

## 3. VPS Directory Structure

```
/home/shovelsolutions/
├── apps/
│   └── claimverify_source/         # ← Backend Django project root
│       ├── manage.py
│       ├── core/
│       ├── users/
│       ├── media/                  # Uploaded files (persistent, DO NOT delete)
│       ├── tmp/
│       │   └── restart.txt         # Touch this to restart Passenger
│       └── .env                    # Production environment variables
├── claimverify.shovelsolutions.in/ # ← Frontend web root (Apache serves this)
│   ├── index.html
│   ├── assets/                     # Vite-built JS/CSS bundles
│   └── .htaccess                   # SPA routing rewrites
├── virtualenvs/
│   └── claimverify/                # Python virtual environment
│       └── bin/python
├── deployment_backups/             # Pre-deploy backups (keep these)
└── tmp/                            # Temporary extraction (safe to delete after deploy)
```

---

## 4. Golden Rules

> [!CAUTION]
> Violating any of these rules can break the live production site.

1. **Never delete `~/apps/claimverify_source/media/`** — it contains user-uploaded files.
2. **Never delete `~/deployment_backups/`** — it's the rollback safety net.
3. **Always back up before replacing files** on the VPS.
4. **Always run `py_compile` and `manage.py check`** after copying backend files.
5. **Always restart Passenger** (`touch tmp/restart.txt`) after backend changes.
6. **Always re-create `.htaccess`** after frontend deployment (or verify it's intact).
7. **Frontend web root is `~/claimverify.shovelsolutions.in/`** — NOT `~/apps/claimverify_frontend_dist/`.
8. **Backend app root is `~/apps/claimverify_source/`** — NOT `~/apps/claimverify/`.
9. **Do NOT run `pip install` or `manage.py migrate`** unless explicitly required and approved.
10. **Only include changed files** in deployment zips — never the entire project.

---

## 5. Backend Deployment

### 5.1 Identify Changed Files

Compare local files against the last deployed commit/state. Typical files that change:

| Category | Files |
|----------|-------|
| API endpoints | `users/api/cases.py`, `users/api/vendor_cases.py`, `users/api/users.py`, etc. |
| DB helpers | `users/incident_case_db.py` |
| Models | `users/models.py`, `users/schemas.py` |
| Services | `users/services/*.py` |
| Core config | `core/api.py`, `core/urls.py`, `core/media_serve.py`, `core/settings.py` |
| Migrations | `users/migrations/XXXX_*.py` |

### 5.2 Create Backend Zip (Local PowerShell)

Create a zip that preserves the folder structure exactly as it exists in the repo. Only include files that changed.

```powershell
# Example: zip specific changed files
Compress-Archive -Path @(
    "users\api\cases.py",
    "users\api\vendor_cases.py",
    "users\incident_case_db.py"
) -DestinationPath "claimverify-backend-YYYYMMDD.zip" -Force
```

> [!IMPORTANT]
> The zip must preserve the directory structure (e.g., `users/api/cases.py` inside the zip, NOT just `cases.py`).
> Run this command from the project root: `D:\Shoveltech\Shoveltech Internal Porject\`

### 5.3 Upload to VPS (Local PowerShell)

```powershell
scp "D:\Shoveltech\Shoveltech Internal Porject\claimverify-backend-YYYYMMDD.zip" shovelsolutions@<VPS_IP>:~/
```

### 5.4 Deploy on VPS (SSH)

```bash
# ── 1. Extract ──
cd ~
rm -rf ~/tmp/claimverify_backend_YYYYMMDD
mkdir -p ~/tmp/claimverify_backend_YYYYMMDD
unzip -q ~/claimverify-backend-YYYYMMDD.zip -d ~/tmp/claimverify_backend_YYYYMMDD

# ── 2. Backup current files ──
cd ~/apps/claimverify_source
mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_backend_before_YYYYMMDD_$(date +%Y%m%d_%H%M%S).tar.gz \
  users/api/cases.py \
  users/api/vendor_cases.py \
  users/incident_case_db.py
# ↑ List ALL files you are about to replace

# ── 3. Copy new files ──
cp ~/tmp/claimverify_backend_YYYYMMDD/users/api/cases.py users/api/cases.py
cp ~/tmp/claimverify_backend_YYYYMMDD/users/api/vendor_cases.py users/api/vendor_cases.py
cp ~/tmp/claimverify_backend_YYYYMMDD/users/incident_case_db.py users/incident_case_db.py
# ↑ One cp command per file

# ── 4. Syntax check (one per file) ──
~/virtualenvs/claimverify/bin/python -m py_compile users/api/cases.py
~/virtualenvs/claimverify/bin/python -m py_compile users/api/vendor_cases.py
~/virtualenvs/claimverify/bin/python -m py_compile users/incident_case_db.py

# ── 5. Django system check ──
~/virtualenvs/claimverify/bin/python manage.py check

# ── 6. Run migrations (ONLY if new migration files were included) ──
# ~/virtualenvs/claimverify/bin/python manage.py migrate users

# ── 7. Restart Passenger ──
touch tmp/restart.txt
sleep 3

# ── 8. Verify API health ──
curl -i https://api.claimverify.shovelsolutions.in/api/health | head -40
```

### 5.5 Backend Verification Checklist

- [ ] `py_compile` passes for every copied file (no output = success)
- [ ] `manage.py check` shows "System check identified no issues"
- [ ] `curl` to health endpoint returns `HTTP 200` with `"status": "healthy"`
- [ ] Test the specific business flow affected by the change

### 5.6 Backend Rollback (If Needed)

```bash
cd ~/apps/claimverify_source
# Find the latest backup
ls -lt ~/deployment_backups/ | head -5

# Extract the backup over the live files
tar -xzf ~/deployment_backups/claimverify_backend_before_YYYYMMDD_TIMESTAMP.tar.gz

# Restart
touch tmp/restart.txt
```

---

## 6. Frontend Deployment

### 6.1 Build the Frontend (Local PowerShell)

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\frontend"
npm run build
```

This produces built output in `frontend/dist/`. The build uses `.env.production` which sets:
```
VITE_API_BASE_URL=https://api.claimverify.shovelsolutions.in/api
```

### 6.2 Create Frontend Zip (Local PowerShell)

```powershell
Compress-Archive -Path "D:\Shoveltech\Shoveltech Internal Porject\frontend\dist\*" `
  -DestinationPath "D:\Shoveltech\Shoveltech Internal Porject\frontend-dist-claimverify-YYYYMMDD.zip" -Force
```

### 6.3 Upload to VPS (Local PowerShell)

```powershell
scp "D:\Shoveltech\Shoveltech Internal Porject\frontend-dist-claimverify-YYYYMMDD.zip" shovelsolutions@<VPS_IP>:~/
```

### 6.4 Deploy on VPS (SSH)

```bash
# ── 1. Extract ──
cd ~
rm -rf ~/tmp/claimverify_frontend_dist_YYYYMMDD
mkdir -p ~/tmp/claimverify_frontend_dist_YYYYMMDD
unzip -q ~/frontend-dist-claimverify-YYYYMMDD.zip -d ~/tmp/claimverify_frontend_dist_YYYYMMDD

# ── 2. Backup current frontend ──
mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_frontend_before_YYYYMMDD_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C ~/ claimverify.shovelsolutions.in/

# ── 3. Replace frontend files ──
cd ~/claimverify.shovelsolutions.in
rm -rf assets
rm -f index.html vite.svg
cp -a ~/tmp/claimverify_frontend_dist_YYYYMMDD/. ~/claimverify.shovelsolutions.in/

# ── 4. Ensure .htaccess exists (SPA routing) ──
cat > .htaccess <<'HT'
RewriteEngine On

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ index.html [L]
HT

# ── 5. Verify ──
curl -I https://claimverify.shovelsolutions.in | head -10
```

### 6.5 Frontend Verification Checklist

- [ ] `curl` returns `HTTP/2 200`
- [ ] Web portal loads in browser (hard refresh `Ctrl+Shift+R`)
- [ ] No blank page (check for correct `index.html` and `assets/` directory)
- [ ] Browser DevTools → Network tab shows the new JS bundle hash (filename changes with each build)
- [ ] SPA routing works (e.g., navigating to `/case_manager/cases` directly doesn't 404)

### 6.6 Frontend Rollback (If Needed)

```bash
cd ~
tar -xzf ~/deployment_backups/claimverify_frontend_before_YYYYMMDD_TIMESTAMP.tar.gz
# This restores ~/claimverify.shovelsolutions.in/ to the backed-up state
```

---

## 7. Database Migrations

> [!WARNING]
> Only run migrations when new migration files are included in the deployment. Most deployments are code-only.

If new migration files are part of the deployment:

```bash
cd ~/apps/claimverify_source

# First, copy the migration file(s)
cp ~/tmp/claimverify_backend_YYYYMMDD/users/migrations/XXXX_migration_name.py users/migrations/

# Then run migrate
~/virtualenvs/claimverify/bin/python manage.py migrate users

# Restart
touch tmp/restart.txt
```

### Migration Tips

- The VPS database is PostgreSQL. Migrations that work on local PostgreSQL should work on VPS.
- Always check current migration state first: `~/virtualenvs/claimverify/bin/python manage.py showmigrations users | tail -20`
- If a migration adds columns to raw SQL tables (not Django ORM models), it may use `RunSQL` operations.

---

## 8. Vendor Mobile App Deployment

The Vendor Portal is a React Native app built with Expo. It is NOT deployed to the VPS.

### 8.1 Local Development

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npx expo start -c
```

### 8.2 Production APK Build

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npx eas-cli build -p android --profile preview
```

The production API URL is configured in the app's environment/config to point to `https://api.claimverify.shovelsolutions.in/api`.

### 8.3 OTA Updates

Currently OTA updates are **not enabled**. Any JS changes require a new APK build.

---

## 9. Post-Deploy Cleanup

> [!CAUTION]
> Only clean up after verifying ALL endpoints are working correctly.

```bash
cd ~
rm -f ~/claimverify-backend-YYYYMMDD.zip ~/frontend-dist-claimverify-YYYYMMDD.zip
rm -rf ~/tmp/claimverify_backend_YYYYMMDD ~/tmp/claimverify_frontend_dist_YYYYMMDD
```

**Never delete:**
- `~/deployment_backups/` — rollback safety net
- `~/apps/claimverify_source/media/` — user uploaded files
- `~/apps/claimverify_source/.env` — production environment config

---

## 10. Common Failure Points & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| API health returns 500 | Import error in Python code | Check `py_compile` output; check Passenger error log |
| Web portal blank page | Wrong dist deployed, or `index.html` missing | Verify `ls ~/claimverify.shovelsolutions.in/index.html` exists |
| Web portal shows old version after deploy | Browser cache | Hard refresh `Ctrl+Shift+R`; verify new JS bundle hash |
| SPA routes return 404 | Missing or broken `.htaccess` | Re-create the `.htaccess` file (see §6.4 step 4) |
| "Failed to fetch check detail" in vendor app | Missing DB columns | Run the relevant migration or manually `ALTER TABLE` |
| Vendor app shows 0 checks | Vendor ID mismatch or API filtering bug | Check `assigned_vendor_id` in the database matches the logged-in vendor |
| Media files return 404 | File path mismatch (spaces vs underscores, double `/api/media/`) | Check `core/media_serve.py` path normalization logic |
| `unzip` shows "backslashes as path separators" warning | Zip created on Windows | This is just a warning and can be safely ignored; files extract correctly |

---

## 11. Environment Variables Reference

The backend `.env` on the VPS contains these keys (see `.env.example` for the full template):

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `False` in production |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames |
| `DB_ENGINE` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | PostgreSQL connection |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins |
| `GROQ_API_KEY` | Groq API for speech-to-text and AI |
| `GOOGLE_MAPS_API_KEY` | Geocoding for evidence location verification |
| `EMAIL_*` | SMTP email settings |
| `SPEECH_*` | Speech-to-text service config |

---

## 12. Quick Reference: Full Deploy (Backend + Frontend)

For a typical deployment that changes both backend and frontend:

### On Local Machine (PowerShell)

```powershell
# 1. Identify changed backend files
cd "D:\Shoveltech\Shoveltech Internal Porject"

# 2. Create backend zip (adjust file list)
Compress-Archive -Path @(
    "users\api\cases.py",
    "users\api\vendor_cases.py",
    "users\incident_case_db.py"
) -DestinationPath "claimverify-backend-YYYYMMDD.zip" -Force

# 3. Build frontend
cd frontend
npm run build
cd ..

# 4. Create frontend zip
Compress-Archive -Path "frontend\dist\*" `
  -DestinationPath "frontend-dist-claimverify-YYYYMMDD.zip" -Force

# 5. Upload both to VPS
scp "claimverify-backend-YYYYMMDD.zip" shovelsolutions@<VPS_IP>:~/
scp "frontend-dist-claimverify-YYYYMMDD.zip" shovelsolutions@<VPS_IP>:~/
```

### On VPS (SSH)

```bash
# ── BACKEND ──
cd ~
rm -rf ~/tmp/claimverify_backend_YYYYMMDD
mkdir -p ~/tmp/claimverify_backend_YYYYMMDD
unzip -q ~/claimverify-backend-YYYYMMDD.zip -d ~/tmp/claimverify_backend_YYYYMMDD

cd ~/apps/claimverify_source
mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/backend_before_YYYYMMDD_$(date +%Y%m%d_%H%M%S).tar.gz \
  users/api/cases.py users/api/vendor_cases.py users/incident_case_db.py

cp ~/tmp/claimverify_backend_YYYYMMDD/users/api/cases.py users/api/cases.py
cp ~/tmp/claimverify_backend_YYYYMMDD/users/api/vendor_cases.py users/api/vendor_cases.py
cp ~/tmp/claimverify_backend_YYYYMMDD/users/incident_case_db.py users/incident_case_db.py

~/virtualenvs/claimverify/bin/python -m py_compile users/api/cases.py
~/virtualenvs/claimverify/bin/python -m py_compile users/api/vendor_cases.py
~/virtualenvs/claimverify/bin/python -m py_compile users/incident_case_db.py
~/virtualenvs/claimverify/bin/python manage.py check

touch tmp/restart.txt
sleep 3
curl -i https://api.claimverify.shovelsolutions.in/api/health | head -40

# ── FRONTEND ──
cd ~
rm -rf ~/tmp/claimverify_frontend_dist_YYYYMMDD
mkdir -p ~/tmp/claimverify_frontend_dist_YYYYMMDD
unzip -q ~/frontend-dist-claimverify-YYYYMMDD.zip -d ~/tmp/claimverify_frontend_dist_YYYYMMDD

mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/frontend_before_YYYYMMDD_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C ~/ claimverify.shovelsolutions.in/

cd ~/claimverify.shovelsolutions.in
rm -rf assets
rm -f index.html vite.svg
cp -a ~/tmp/claimverify_frontend_dist_YYYYMMDD/. ~/claimverify.shovelsolutions.in/

cat > .htaccess <<'HT'
RewriteEngine On

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ index.html [L]
HT

curl -I https://claimverify.shovelsolutions.in | head -10

# ── CLEANUP ──
cd ~
rm -f ~/claimverify-backend-YYYYMMDD.zip ~/frontend-dist-claimverify-YYYYMMDD.zip
rm -rf ~/tmp/claimverify_backend_YYYYMMDD ~/tmp/claimverify_frontend_dist_YYYYMMDD
```

---

## 13. Notes For Another Coding Agent

1. **Replace `YYYYMMDD` and `<VPS_IP>`** with the actual date and server IP in all commands.
2. **Adjust the file list** in zip creation, backup, and copy commands to match the actual changed files.
3. **Prefer targeted fixes** over broad rewrites — only deploy files that actually changed.
4. **The `unzip` warning about backslashes** from Windows-created zips is harmless — files extract correctly.
5. **After frontend deploy**, the user must hard refresh (`Ctrl+Shift+R`) to see changes.
6. **If a migration is needed**, always run `showmigrations` first to confirm the current state.
7. **Do not modify the local project** during or for deployment — the local dev environment must remain fully functional.
8. **Test locally first** before deploying — run `python manage.py runserver 0.0.0.0:8001` and `npm run dev` to verify changes work.
