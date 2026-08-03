# ClaimVerify production fixes deployment

This deployment updates only the ClaimVerify backend app and the ClaimVerify web frontend.

## Backend files changed

- users/api/users.py
- users/api/verifications.py
- users/api/cases.py

## Frontend artifact

- frontend-dist-claimverify.zip

## VPS backend deploy commands

Run from the VPS after uploading the three backend files into `~/tmp/claimverify_backend_fixes/users/api/`.

```bash
cd ~/apps/claimverify_source

mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_backend_before_user_case_activity_fix_$(date +%Y%m%d_%H%M%S).tar.gz users/api/users.py users/api/verifications.py users/api/cases.py

cp ~/tmp/claimverify_backend_fixes/users/api/users.py users/api/users.py
cp ~/tmp/claimverify_backend_fixes/users/api/verifications.py users/api/verifications.py
cp ~/tmp/claimverify_backend_fixes/users/api/cases.py users/api/cases.py

~/virtualenvs/claimverify/bin/python -m py_compile users/api/users.py users/api/verifications.py users/api/cases.py
touch tmp/restart.txt
sleep 3
curl -i https://api.claimverify.shovelsolutions.in/api/health 2>&1 | head -40
```

## VPS frontend deploy commands

Run after uploading `frontend-dist-claimverify.zip` to `/home/shovelsolutions/frontend-dist-claimverify.zip`.

```bash
cd ~
rm -rf ~/tmp/claimverify_frontend_dist
mkdir -p ~/tmp/claimverify_frontend_dist
unzip -q ~/frontend-dist-claimverify.zip -d ~/tmp/claimverify_frontend_dist

mkdir -p ~/deployment_backups
tar -czf ~/deployment_backups/claimverify_frontend_before_user_case_activity_fix_$(date +%Y%m%d_%H%M%S).tar.gz -C ~ claimverify.shovelsolutions.in

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
```

## Smoke checks after deploy

```bash
curl -i https://api.claimverify.shovelsolutions.in/api/health 2>&1 | head -40
curl -I https://claimverify.shovelsolutions.in 2>&1 | head -30
curl -I https://claimverify.shovelsolutions.in/admin/cases 2>&1 | head -30
```
