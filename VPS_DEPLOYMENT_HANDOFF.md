# ClaimVerify VPS Deployment Handoff

This document is the deployment playbook for the ClaimVerify project.
It is written so another coding agent can package changes, upload them to the VPS, deploy safely, and verify the result without affecting unrelated apps on the server.

## 1. Project Layout

Local workspace:
- `D:\Shoveltech\Shoveltech Internal Porject`

Main app parts:
- Backend: `users/`, `core/`, `manage.py`
- Frontend web portal: `claimverify.shovelsolutions.in/`
- Vendor mobile app: `Vendor_Portal/`

VPS paths used in production:
- Backend app root: `~/apps/claimverify_source`
- Frontend web root: `~/claimverify.shovelsolutions.in`
- Temporary extraction folders: `~/tmp/...`
- Backup folder: `~/deployment_backups`
- Passenger restart marker: `~/apps/claimverify_source/tmp/restart.txt`

Production endpoints:
- API health: `https://api.claimverify.shovelsolutions.in/api/health`
- Web portal: `https://claimverify.shovelsolutions.in`

## 2. Golden Rules

- Only change the files related to the fix.
- Do not touch unrelated apps or server-wide config.
- Always take a backup before copying files into the VPS app folders.
- After backend changes, run `py_compile`, `manage.py check`, then restart Passenger.
- After frontend changes, replace the built web dist only, then verify the root page loads.
- Keep any uploaded zip files and temp extraction folders separate from the live app root.

## 3. Backend Deployment Workflow

Use this when the fix touches Django / Ninja API code.

Typical backend files changed in this project:
- `users/api/*.py`
- `users/models.py`
- `users/schemas.py`
- `users/migrations/*.py`

### 3.1 Create a backend zip locally

Build a zip that preserves the source layout expected by the VPS.
Only include the files that changed.

Example structure inside the zip:
- `users/api/vendor_cases.py`
- `users/api/users.py`
- `users/api/auth.py`
- `users/api/vendors.py`
- `users/schemas.py`
- `users/models.py`
- `users/migrations/xxxx_new_migration.py`

Recommended zip naming:
- `claimverify-<short-fix-name>-YYYYMMDD.zip`

### 3.2 Upload and deploy on VPS

Example commands:

```bash
cd ~
rm -rf ~/tmp/claimverify_<fix_name>
mkdir -p ~/tmp/claimverify_<fix_name>
unzip -q ~/claimverify-<fix-name>-YYYYMMDD.zip -d ~/tmp/claimverify_<fix_name>

cd ~/apps/claimverify_source
mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_backend_before_<fix_name>_$(date +%Y%m%d_%H%M%S).tar.gz \
  users/api/vendor_cases.py users/api/users.py users/api/auth.py users/api/vendors.py users/schemas.py users/models.py

cp ~/tmp/claimverify_<fix_name>/users/api/vendor_cases.py users/api/vendor_cases.py
# copy any other changed backend files the same way

~/virtualenvs/claimverify/bin/python -m py_compile users/api/vendor_cases.py
~/virtualenvs/claimverify/bin/python manage.py check

touch tmp/restart.txt
sleep 3

curl -i https://api.claimverify.shovelsolutions.in/api/health | head -40
```

### 3.3 Backend verification checklist

- `manage.py check` passes.
- API health endpoint returns `200 OK`.
- The specific user flow affected by the fix is manually tested.
- No unrelated endpoints are failing.

## 4. Frontend Web Portal Deployment Workflow

Use this when the fix touches the React/Vite web portal.

Typical frontend root:
- `claimverify.shovelsolutions.in/`

Built dist usually comes from:
- `frontend-dist-claimverify.zip`

### 4.1 Create or receive the frontend dist zip

The zip should contain the built web app output, not the source tree.

Expected dist contents:
- `index.html`
- `assets/`
- any other built static files

### 4.2 Upload and deploy on VPS

Example commands:

```bash
cd ~
rm -rf ~/tmp/claimverify_frontend_dist
mkdir -p ~/tmp/claimverify_frontend_dist
unzip -q ~/frontend-dist-claimverify.zip -d ~/tmp/claimverify_frontend_dist

cd ~/claimverify.shovelsolutions.in
mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_frontend_before_<fix_name>_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C ~ claimverify.shovelsolutions.in

rm -rf assets
rm -f index.html vite.svg
cp -a ~/tmp/claimverify_frontend_dist/. ~/claimverify.shovelsolutions.in/

cat > .htaccess <<'HT'
RewriteEngine On

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ index.html [L]
HT

curl -I https://claimverify.shovelsolutions.in | head -30
```

### 4.3 Frontend verification checklist

- `https://claimverify.shovelsolutions.in` loads with `HTTP/2 200`.
- Deep links like `/admin/ai-brief` or similar portal routes resolve correctly.
- Browser console has no new production-breaking errors.

## 5. Vendor Mobile App Deployment

This project has a separate mobile app in:
- `Vendor_Portal/`

Important note:
- The current EAS setup in this project has OTA updates disabled unless explicitly configured.
- If `updates.enabled` is `false`, small JS changes still require a new APK build.

### 5.1 Local development

Use this for testing changes locally:

```bash
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npx expo start -c
```

### 5.2 APK build

If you need a production APK:

```bash
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npx eas-cli build -p android --profile preview
```

If you have a local Linux/macOS build environment and local Android build support:

```bash
npx eas-cli build -p android --profile preview --local
```

### 5.3 EAS update

If OTA updates are enabled in the future, the workflow is:

```bash
npx eas-cli update --channel preview --message "Short description of change"
```

Do not rely on OTA updates unless the app is configured for it and the installed build supports that channel.

## 6. What To Put In The Zip

### Backend zip
Include only changed backend source files and migrations.
Keep the folder paths exactly as they exist in the repo.

### Frontend zip
Include only the built `dist` output, not source files.
The VPS web root expects static files directly in `~/claimverify.shovelsolutions.in`.

## 7. Safe Cleanup

After a successful deploy, it is safe to delete:
- the uploaded zip from `~/` on the VPS
- the extracted temp folder under `~/tmp/...`

Keep:
- `~/deployment_backups`

because that is your rollback safety net.

## 8. Common Failure Points

- API health returns 500: Passenger restart or backend import error.
- Web portal loads blank: wrong frontend dist copied, or `index.html` missing.
- Vendor app cannot open a check: detail endpoint and assignment IDs must match the assignment data stored in the database.
- Vendor app shows 0 checks: list endpoint is filtering with the wrong vendor ID.
- New user roles or password fields not showing: frontend modal code and backend payload must stay in sync.

## 9. Recommended Deployment Habit

For every change, do this sequence:
1. Identify the exact file list.
2. Build a zip that contains only those files.
3. Back up the live VPS file(s).
4. Copy the changed files into the live app.
5. Run syntax checks.
6. Restart the backend if needed.
7. Verify the live endpoint.
8. Test the actual business flow in the portal or mobile app.

## 10. Notes For Another Coding Agent

- Prefer targeted fixes over broad rewrites.
- Preserve existing production paths and conventions.
- If a bug involves old and new data formats, support both where possible.
- If a route works for list data but fails for detail data, inspect the ID matching logic first.
- Do not delete backups until the deployment is confirmed working in production.
