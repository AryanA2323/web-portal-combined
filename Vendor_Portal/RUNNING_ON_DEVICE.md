# Vendor Portal - Running on Physical Device

## Current Status
✅ Expo development server is running at: `http://192.168.31.164:8081`
✅ QR code is displayed in terminal for scanning

## Steps to Run on Your Android Phone

### Prerequisites
- Android phone with USB debugging enabled (or on same WiFi)
- "Expo Go" app installed from Google Play Store
- Phone and laptop on same WiFi network (192.168.31.x)

### Method 1: Scan QR Code (Recommended)

1. **On Your Phone:**
   - Open Expo Go app
   - Tap the QR code scanner icon at the bottom
   - Point camera at the QR code in your terminal

2. **Wait for App to Load:**
   - Metro Bundler will compile your JavaScript
   - App will appear on your phone screen
   - Takes 30-60 seconds first time

3. **Test the App:**
   - You should see the Login screen
   - Backend must be running: `python manage.py runserver 0.0.0.0:8000`
   - Try logging in with vendor credentials

### Method 2: Using Expo Go from Terminal

If scanning doesn't work, use this alternative:

```bash
# In terminal running expo start, press 'a' for Android
a
```

This will attempt to launch Expo Go on connected devices.

### Method 3: USB Connection

If WiFi connection fails:

1. **Connect phone via USB to laptop**
2. **Enable USB debugging:**
   - Settings → Developer options → USB debugging
3. **Run in terminal:**
   ```bash
   adb reverse tcp:8081 tcp:8081
   expo start
   ```
4. Scan QR code on phone

## Login Credentials

Create a vendor account in Django admin:
- **URL:** `http://192.168.31.164:8000/admin`
- **Example:** 
  - Email: `vendor@example.com`
  - Password: `password123`
  - Role: `vendor`

Or use an existing vendor account if available.

## What to Test

1. **Login Screen:**
   - Enter vendor email
   - Enter password
   - Tap "Sign In"
   - Should redirect to Dashboard

2. **Dashboard:**
   - Should display "Welcome back, [Vendor Name]"
   - Shows list of assigned cases
   - Each case displays:
     - Case number
     - Status badge (colored)
     - Title
     - Description
     - Date created
     - Priority level

3. **Logout:**
   - Tap "Logout" button in top-right
   - Should return to Login screen

4. **Refresh:**
   - Pull down on case list to refresh
   - Loading indicator should appear

## Common Issues

### Issue: Cannot reach backend (API error)
**Solution:** 
- Ensure backend is running: `python manage.py runserver 0.0.0.0:8000`
- Check Django CORS settings include phone IP
- Verify phone and laptop on same WiFi

### Issue: QR code scanner not working
**Alternative:** 
- Copy the URL from terminal (format: `exp://192.168.31.164:8081`)
- In Expo Go, paste in address bar
- App should load

### Issue: Login fails with 401
**Causes:**
- Vendor account doesn't exist
- Email/password incorrect
- CORS not configured in Django

**Fix:**
- Check vendor exists in Django admin
- Verify email is correct (check case sensitivity)
- Add CORS headers in Django settings.py

### Issue: Cases list is empty
**Causes:**
- No cases assigned to vendor in database
- Wrong vendor ID being used
- API endpoint returns different format

**Fix:**
- Create test case in Django admin
- Assign to vendor
- Refresh app (pull down)

### Issue: App crashes immediately
**Debug:**
- Check terminal for error messages
- Look at Expo Go console (shake phone → Show developer menu)
- Check browser console if running on web

## Terminal Commands During Development

While `expo start` is running:

```
a     - Open app on Android
w     - Open in web browser
i     - Open iOS
r     - Reload app
m     - Toggle developer menu
d     - Toggle debugging
j     - Open Debugger
?     - Show all commands
C-c   - Stop server
```

## Performance Tips

1. **Fast Refresh:** Changes to code auto-reload on phone
2. **Network:** Stay on same WiFi for best performance
3. **Emulator:** If using Android emulator instead of phone:
   - Run: `expo start` then press `a`
   - Will open emulator automatically

## Next Steps

After successfully running on phone:

1. **Test all features:**
   - Login with different vendor accounts
   - Verify cases display correctly
   - Test pull-to-refresh
   - Test logout and re-login

2. **Build for production:**
   ```bash
   expo build:android -t apk
   ```
   This creates a standalone APK you can install without Expo Go

3. **Add more features:**
   - Case detail screen
   - Case filters/search
   - Push notifications
   - Photo upload

## Backend Configuration Required

Ensure `core/settings.py` has:

```python
# CORS configuration
INSTALLED_APPS = [
    ...
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    ...
]

CORS_ALLOWED_ORIGINS = [
    'http://192.168.31.164:8081',
    'http://localhost:8081',
    'http://192.168.31.164:8000',
]

# JWT settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}
```

## File Structure Recap

```
Vendor_Portal/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx      ← Login form
│   │   └── DashboardScreen.tsx  ← Cases list
│   ├── store/
│   │   ├── authSlice.ts         ← Login state
│   │   ├── casesSlice.ts        ← Cases state
│   │   └── index.ts
│   ├── services/
│   │   └── api.ts               ← API calls
│   ├── config/
│   │   ├── constants.ts         ← API_BASE_URL = '192.168.31.164:8000/api'
│   │   └── theme.ts
│   └── App.tsx                  ← Root component
├── app/
│   └── _layout.tsx              ← Expo entry point
└── package.json
```

## Support Resources

- **Expo Docs:** https://docs.expo.dev
- **React Native Docs:** https://reactnative.dev
- **Redux Docs:** https://redux.js.org
- **Terminal Help:** Type `?` during `expo start`
