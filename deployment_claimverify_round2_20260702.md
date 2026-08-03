# ClaimVerify round 2 production fixes deployment

This package contains:

- Backend fixes for vendor profile backfill, vendor dropdowns, case/report sync, and report stats.
- Frontend production build.
- Vendor app source changes for vendor-only login. The APK change should be shipped with EAS Update.

Upload `claimverify-production-fixes-20260702-round2.zip` to `/home/shovelsolutions/`.

## Unpack on VPS

```bash
cd ~
rm -rf ~/tmp/claimverify_fixes_round2
mkdir -p ~/tmp/claimverify_fixes_round2
unzip -q ~/claimverify-production-fixes-20260702-round2.zip -d ~/tmp/claimverify_fixes_round2
```

## Backend deploy

```bash
cd ~/apps/claimverify_source

mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_backend_before_round2_$(date +%Y%m%d_%H%M%S).tar.gz users/api/users.py users/api/verifications.py users/api/cases.py users/api/reports.py

cp ~/tmp/claimverify_fixes_round2/users/api/users.py users/api/users.py
cp ~/tmp/claimverify_fixes_round2/users/api/verifications.py users/api/verifications.py
cp ~/tmp/claimverify_fixes_round2/users/api/cases.py users/api/cases.py
cp ~/tmp/claimverify_fixes_round2/users/api/reports.py users/api/reports.py

~/virtualenvs/claimverify/bin/python -m py_compile users/api/users.py users/api/verifications.py users/api/cases.py users/api/reports.py
~/virtualenvs/claimverify/bin/python manage.py check
touch tmp/restart.txt
sleep 3
curl -i https://api.claimverify.shovelsolutions.in/api/health 2>&1 | head -40
```

## Frontend deploy

```bash
cd ~
cp ~/tmp/claimverify_fixes_round2/frontend-dist-claimverify.zip ~/frontend-dist-claimverify.zip

rm -rf ~/tmp/claimverify_frontend_dist
mkdir -p ~/tmp/claimverify_frontend_dist
unzip -q ~/frontend-dist-claimverify.zip -d ~/tmp/claimverify_frontend_dist

mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_frontend_before_round2_$(date +%Y%m%d_%H%M%S).tar.gz -C ~ claimverify.shovelsolutions.in

cd ~/claimverify.shovelsolutions.in
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

curl -I https://claimverify.shovelsolutions.in 2>&1 | head -30
curl -I https://claimverify.shovelsolutions.in/admin/cases 2>&1 | head -30
```

## Vendor APK OTA update

Run locally from PowerShell:

```powershell
cd "D:\Shoveltech\Shoveltech Internal Porject\Vendor_Portal"
npx eas-cli update --channel preview --message "Restrict vendor app login to vendor accounts"
```

If EAS says the channel option is not available in your CLI version, run:

```powershell
npx eas-cli update --branch preview --message "Restrict vendor app login to vendor accounts"
```
