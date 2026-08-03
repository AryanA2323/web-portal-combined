# ClaimVerify Deployment Handoff

This document is for the next coding agent who needs to deploy the updated ClaimVerify project. It captures the deployment approach already used, the server paths, commands, known production gotchas, and verification steps.

## Project Parts

The workspace contains three deployable parts:

- `core/`, `users/`, `manage.py`, `requirements.txt`: Django backend API.
- `frontend/`: React/Vite web portal for Super Admin, Admin/Case Manager, Lawyer, Client, etc.
- `Vendor_Portal/`: Expo React Native Android vendor app.

Production URLs:

- Web portal: `https://claimverify.shovelsolutions.in`
- API: `https://api.claimverify.shovelsolutions.in/api`
- API health: `https://api.claimverify.shovelsolutions.in/api/health`

Production VPS paths:

- Backend app: `/home/shovelsolutions/apps/claimverify_source`
- Backend venv: `/home/shovelsolutions/virtualenvs/claimverify`
- Web document root: `/home/shovelsolutions/claimverify.shovelsolutions.in`
- Deployment backups: `/home/shovelsolutions/deployment_backups`

Important: Do not touch other apps on the VPS. Only deploy inside the ClaimVerify paths above.

## Previous Deployment History And Gotchas

The backend runs under cPanel/Apache Phusion Passenger.

There was a previous Passenger failure where Passenger used `/usr/bin/python3` Python 3.6 instead of the virtualenv Python 3.12. Django dependencies then failed with syntax errors. The VPS team fixed Passenger to use:

```text
/home/shovelsolutions/virtualenvs/claimverify/bin/python
Python 3.12.13
```

If the API ever returns the Passenger HTML error page again, check the runtime Python first. The app must run on the virtualenv Python, not system Python.

Current clean `passenger_wsgi.py` pattern:

```python
import os
import sys

APP_ROOT = "/home/shovelsolutions/apps/claimverify_source"
VENV_SITE = "/home/shovelsolutions/virtualenvs/claimverify/lib64/python3.12/site-packages"

if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

if VENV_SITE not in sys.path:
    sys.path.insert(0, VENV_SITE)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

from core.wsgi import application
```

Previous frontend deployment was done by uploading `frontend-dist-claimverify.zip`, extracting it on the VPS, backing up the old web root, replacing `assets/` and `index.html`, and restoring an SPA `.htaccess`.

The vendor app previously hit Expo OTA download errors:

```text
java.io.IOException: Failed to download remote update
```

The permanent fix was to disable Expo OTA updates in `Vendor_Portal/app.json`:

```json
"updates": {
  "enabled": false
}
```

Because OTA is disabled, vendor app JavaScript changes now require a new APK build and install. Do not rely on `eas update` for the vendor APK unless OTA is intentionally re-enabled later.

## Local Environment Notes

Backend uses:

- Python/Django `Django==6.0.1`
- PostgreSQL via `psycopg2-binary`
- Env loaded from `.env`

Frontend uses:

- Vite React
- Production API env: `frontend/.env.production`

Vendor app uses:

- Expo SDK 54
- Android package: `in.shovelsolutions.claimverify.vendor`
- EAS project ID: `0c9954ca-ac4a-4923-860b-1f28b7542ce7`
- Current app version in `Vendor_Portal/app.json`: `1.0.2`
- Current Android `versionCode`: `3`
- Current production API base URL in `app.json`: `https://api.claimverify.shovelsolutions.in/api`

For local Expo testing on a physical Android phone, run Django on all interfaces:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject"
.\.venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```

Then run Expo LAN mode:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npx expo start --lan -c
```

`Vendor_Portal/src/config/constants.ts` is designed to use the Metro host IP during `__DEV__` so Expo Go talks to the local Django server instead of production.

## Pre-Deployment Checks

Run these locally before packaging:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject"
.\.venv\Scripts\Activate.ps1
python manage.py check
python -m py_compile users\api\auth.py users\api\cases.py users\api\reports.py users\api\users.py users\api\vendor_cases.py
```

Check the API login locally if needed:

```powershell
python manage.py runserver 0.0.0.0:8000
```

In a second terminal:

```powershell
$body = @{ username = "contact@alphainvestigations.com"; password = "Vendor@123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/auth/login" -ContentType "application/json" -Body $body
```

For the web frontend:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\frontend"
npm install
npm run build
```

For the vendor app:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npm install
npx expo-doctor
```

Note: `npx tsc --noEmit` may currently show a pre-existing type issue around `CompletedScreen.tsx` / `insured_cum_driver`. Confirm whether that is still present before treating it as deployment-blocking.

## Prepare Backend Zip Locally

Create a backend source zip containing only the Django source needed by production. Do not include `.env`, virtualenv, database files, `media/`, `frontend/`, or `Vendor_Portal/`.

PowerShell:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$stage = "$env:TEMP\claimverify_backend_$stamp"
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item -Recurse -Force core "$stage\core"
Copy-Item -Recurse -Force users "$stage\users"
Copy-Item -Force manage.py "$stage\manage.py"
Copy-Item -Force requirements.txt "$stage\requirements.txt"

Get-ChildItem -Path $stage -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Include "*.pyc","*.pyo" | Remove-Item -Force

Compress-Archive -Force -Path "$stage\*" -DestinationPath ".\claimverify-backend-source.zip"
```

Upload this file to the VPS as:

```text
/home/shovelsolutions/claimverify-backend-source.zip
```

## Deploy Backend On VPS

SSH into the VPS as `shovelsolutions`.

```bash
cd ~
rm -rf ~/tmp/claimverify_backend_source
mkdir -p ~/tmp/claimverify_backend_source
unzip -q ~/claimverify-backend-source.zip -d ~/tmp/claimverify_backend_source
```

Back up the current backend:

```bash
mkdir -p ~/deployment_backups
cd ~/apps/claimverify_source
tar -czf ~/deployment_backups/claimverify_backend_before_update_$(date +%Y%m%d_%H%M%S).tar.gz core users manage.py requirements.txt passenger_wsgi.py
```

Copy the updated source:

```bash
cd ~/apps/claimverify_source
cp -a ~/tmp/claimverify_backend_source/core/. core/
cp -a ~/tmp/claimverify_backend_source/users/. users/
cp -a ~/tmp/claimverify_backend_source/manage.py manage.py
cp -a ~/tmp/claimverify_backend_source/requirements.txt requirements.txt
```

Install/update Python dependencies only through the app virtualenv:

```bash
~/virtualenvs/claimverify/bin/python -m pip install -r requirements.txt
```

Run checks and migrations:

```bash
~/virtualenvs/claimverify/bin/python -m py_compile users/api/auth.py users/api/cases.py users/api/reports.py users/api/users.py users/api/vendor_cases.py
~/virtualenvs/claimverify/bin/python manage.py check
~/virtualenvs/claimverify/bin/python manage.py migrate
```

If static files are used by Django admin/API browsable pages, collect static:

```bash
~/virtualenvs/claimverify/bin/python manage.py collectstatic --noinput
```

Restart Passenger:

```bash
mkdir -p tmp
touch tmp/restart.txt
sleep 3
```

Verify:

```bash
curl -i https://api.claimverify.shovelsolutions.in/api/health 2>&1 | head -40
```

Expected result:

```text
HTTP/2 200
content-type: application/json; charset=utf-8
{"status": "healthy", ...}
```

If a Passenger 500 page appears, check:

```bash
cat logs/passenger_wsgi_error.log 2>/dev/null || true
```

Also verify Passenger is not using `/usr/bin/python3`.

## Prepare Frontend Zip Locally

Confirm production API URL:

```text
frontend/.env.production
VITE_API_BASE_URL=https://api.claimverify.shovelsolutions.in/api
```

Build:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\frontend"
npm install
npm run build
```

Create the exact zip used by the previous deployment process:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\frontend\dist"
Compress-Archive -Force -Path * -DestinationPath "..\..\frontend-dist-claimverify.zip"
```

Upload this file to the VPS as:

```text
/home/shovelsolutions/frontend-dist-claimverify.zip
```

## Deploy Frontend On VPS

```bash
cd ~
rm -rf ~/tmp/claimverify_frontend_dist
mkdir -p ~/tmp/claimverify_frontend_dist
unzip -q ~/frontend-dist-claimverify.zip -d ~/tmp/claimverify_frontend_dist
```

Back up current web root:

```bash
mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_frontend_before_update_$(date +%Y%m%d_%H%M%S).tar.gz -C ~ claimverify.shovelsolutions.in
```

Replace frontend files:

```bash
cd ~/claimverify.shovelsolutions.in
rm -rf assets
rm -f index.html vite.svg
cp -a ~/tmp/claimverify_frontend_dist/. ~/claimverify.shovelsolutions.in/
```

Restore SPA rewrite `.htaccess`:

```bash
cat > .htaccess <<'HT'
RewriteEngine On

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ index.html [L]
HT
```

Verify:

```bash
curl -I https://claimverify.shovelsolutions.in 2>&1 | head -30
curl -I https://claimverify.shovelsolutions.in/admin/cases 2>&1 | head -30
```

Expected result for both:

```text
HTTP/2 200
content-type: text/html
```

Browser verification:

- Hard refresh the deployed site.
- Log in as Super Admin.
- Log in as Admin/Case Manager.
- Confirm cases page, sub-check dropdowns, vendor assignment, AI/legal review, reports, and notifications.
- Log in with two different accounts in two browser tabs/windows and confirm session behavior matches the implemented storage behavior.

## Vendor APK Deployment

Current vendor app has OTA disabled. A new APK is required for vendor app changes.

Before building, confirm:

```json
"updates": {
  "enabled": false
}
```

Confirm production API:

```json
"extra": {
  "apiBaseUrl": "https://api.claimverify.shovelsolutions.in/api"
}
```

Build a preview APK through EAS:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npm install
npx eas-cli build -p android --profile preview
```

The `preview` profile in `Vendor_Portal/eas.json` builds an APK:

```json
"preview": {
  "android": {
    "buildType": "apk"
  },
  "distribution": "internal"
}
```

If building for Google Play later, use production AAB:

```powershell
npx eas-cli build -p android --profile production
```

Do not use Windows local EAS build:

```powershell
npx eas-cli build -p android --profile preview --local
```

That fails because EAS local Android builds require macOS or Linux.

Vendor app verification:

- Install the APK from the EAS build link.
- Only users with role `VENDOR` should be allowed into the app.
- Non-vendor users such as Lawyer/Admin/Client must be rejected.
- Test login with a valid vendor:
  - `contact@alphainvestigations.com`
  - `Vendor@123`
- Test evidence upload.
- Confirm uploaded evidence is visible in:
  - Vendor app
  - Admin AI Brief report
  - Lawyer review modal

## Full Smoke Test Workflow

After backend and frontend deployment, run an end-to-end check:

1. Super Admin login.
2. Create or verify users:
   - Super Admin
   - Admin/Case Manager
   - Vendor
   - Lawyer
   - Client if needed
3. Admin/Case Manager creates a case.
4. Case appears on Cases page immediately after creation.
5. Expand the case row and confirm sub-check rows appear.
6. Assign a vendor to a sub-check. Vendor dropdown must include active vendor accounts.
7. Vendor logs in through the APK and sees assigned case/check.
8. Vendor uploads evidence photos/statements.
9. Admin generates AI brief.
10. Evidence images must render in AI brief report.
11. Assign report to lawyer.
12. Lawyer logs in and opens report review.
13. Evidence images must render in lawyer modal.
14. Lawyer approves/rejects report.
15. Reports and Legal Review pages must stay in sync with Cases.
16. Delete a case and confirm stale reports/legal review rows do not remain.

## Useful Production Commands

Backend health:

```bash
curl -i https://api.claimverify.shovelsolutions.in/api/health 2>&1 | head -40
```

Frontend health:

```bash
curl -I https://claimverify.shovelsolutions.in 2>&1 | head -30
curl -I https://claimverify.shovelsolutions.in/admin/cases 2>&1 | head -30
```

Restart Passenger:

```bash
cd ~/apps/claimverify_source
touch tmp/restart.txt
sleep 3
```

Check Passenger app logs:

```bash
cd ~/apps/claimverify_source
ls -la logs
cat logs/passenger_wsgi_error.log 2>/dev/null || true
```

Check deployment backups:

```bash
ls -lah ~/deployment_backups | tail -20
```

## Rollback

Backend rollback:

```bash
cd ~/apps/claimverify_source
mkdir -p ~/tmp/backend_rollback
tar -xzf ~/deployment_backups/<backend-backup-file>.tar.gz -C ~/tmp/backend_rollback
cp -a ~/tmp/backend_rollback/core/. core/
cp -a ~/tmp/backend_rollback/users/. users/
cp -a ~/tmp/backend_rollback/manage.py manage.py
cp -a ~/tmp/backend_rollback/requirements.txt requirements.txt
touch tmp/restart.txt
sleep 3
curl -i https://api.claimverify.shovelsolutions.in/api/health 2>&1 | head -40
```

Frontend rollback:

```bash
cd ~
mkdir -p ~/tmp/frontend_rollback
tar -xzf ~/deployment_backups/<frontend-backup-file>.tar.gz -C ~/tmp/frontend_rollback
rm -rf ~/claimverify.shovelsolutions.in
cp -a ~/tmp/frontend_rollback/claimverify.shovelsolutions.in ~/claimverify.shovelsolutions.in
curl -I https://claimverify.shovelsolutions.in 2>&1 | head -30
```

Vendor APK rollback:

- Reinstall the previous working APK from the older EAS artifact/build link if available.
- Because OTA is disabled, rollback requires installing another APK.

## Security And Operational Notes

- Never upload `.env` from local unless explicitly intended. Production secrets should remain on the VPS.
- Never upload local `db.sqlite3`.
- Never overwrite `/home/shovelsolutions/media` or production uploaded evidence.
- Never run deployment commands outside the ClaimVerify paths.
- Always back up before replacing backend or frontend files.
- Always use `/home/shovelsolutions/virtualenvs/claimverify/bin/python` on the VPS.
- Do not use `rm -rf` on computed paths unless the path is visibly under the intended ClaimVerify deployment directory.
- Frontend deployment is static; changes do not reflect until a new `frontend-dist-claimverify.zip` is built and copied to the web root.
- Backend deployment reflects after files are copied, migrations are run, and Passenger is restarted.
- Vendor app changes reflect only after a new APK is built and installed because Expo OTA is disabled.

