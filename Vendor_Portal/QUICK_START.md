# Vendor Portal - Quick Start Guide

## 🚀 Current Status
✅ **App is running!** Expo development server is active at `192.168.31.164:8081`

## 📱 Get App on Your Phone in 3 Steps

### Step 1: Install Expo Go (One Time)
- On Android phone: Open Google Play Store
- Search "Expo Go"
- Tap Install

### Step 2: Scan QR Code
- Open Expo Go app
- Tap QR code icon at bottom
- Point camera at QR code in terminal
- App loads automatically

### Step 3: Login & Test
```
Email: vendor@example.com  (or your vendor email)
Password: your_password
```

**Done!** You should see the Dashboard with assigned cases.

---

## 📋 What the App Does

### Login Screen
- Enter vendor email and password
- Form validation
- Error messages if login fails

### Dashboard Screen
- Shows all assigned cases
- Status badges (Open, In Progress, Resolved, Closed)
- Case details: number, title, description, priority, date
- Pull down to refresh
- Logout button

---

## 🔧 Backend Requirements

Your Django backend must have:

1. **Running on port 8000**
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

2. **CORS enabled** in `core/settings.py`
   ```python
   CORS_ALLOWED_ORIGINS = ['http://192.168.31.164:8081']
   ```

3. **Vendor account created** with cases assigned

---

## 🛠️ Development Commands

While `npx expo start` is running, in terminal:

| Key | Action |
|-----|--------|
| `a` | Open on Android phone/emulator |
| `w` | Open in web browser |
| `r` | Reload app |
| `m` | Open developer menu |
| `j` | Open debugger |
| `?` | Show all commands |
| `Ctrl+C` | Stop server |

---

## 📝 Edit Code & See Changes Live

All changes auto-reload on phone!

### Update API URL (if backend is elsewhere)
Edit `src/config/constants.ts`:
```typescript
export const API_BASE_URL = 'http://YOUR_IP:8000/api';
```

### Customize Colors & Fonts
Edit `src/config/theme.ts`

### Add New Fields to Login
Edit `src/screens/LoginScreen.tsx`

### Change Dashboard Layout
Edit `src/screens/DashboardScreen.tsx`

---

## 🔑 Key Files

```
Vendor_Portal/
├── src/
│   ├── App.tsx              ← Root component
│   ├── screens/
│   │   ├── LoginScreen.tsx  ← Login form
│   │   └── DashboardScreen.tsx ← Cases list
│   ├── store/               ← Redux (auth, cases)
│   ├── services/api.ts      ← API calls
│   └── config/constants.ts  ← API_BASE_URL
├── app/_layout.tsx          ← Entry point
└── package.json             ← Dependencies
```

---

## 🐛 Troubleshooting

### "Cannot reach backend"
- Check backend is running: `python manage.py runserver`
- Verify IP: `ipconfig | findstr IPv4`
- Update API_BASE_URL in constants.ts

### "Login fails"
- Ensure vendor account exists in Django admin
- Check email/password are correct
- Check CORS is enabled

### "Cases not loading"
- Create test case in Django admin
- Assign to vendor
- Pull down to refresh

### "App won't load"
- Check terminal for error messages
- Try: `expo start --clear`
- Shake phone in Expo Go → Show Developer Menu → View logs

---

## 📚 Full Documentation

For detailed information, read:
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Complete setup instructions
- **[RUNNING_ON_DEVICE.md](RUNNING_ON_DEVICE.md)** - Device testing guide
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical overview

---

## ✨ Features Included

✅ Secure vendor login
✅ JWT token management
✅ Dashboard with case list
✅ Status color coding
✅ Pull-to-refresh
✅ Error handling
✅ Form validation
✅ Redux state management
✅ TypeScript support
✅ Hot reload during development

---

## 🎯 Next: Test on Phone

1. **Start backend**: `cd incident-management-platform-week2 && python manage.py runserver`
2. **Expo already running**: Terminal shows QR code
3. **Scan QR code**: Use Expo Go to test
4. **Login**: Use vendor credentials
5. **Verify**: See dashboard with cases

---

## 📞 Need Help?

Check these files:
- Error in app? → Check terminal logs
- Can't login? → Check Django logs
- Can't reach API? → Check CORS and IP address
- Code changes not showing? → Reload app (press 'r' in terminal)

---

## 🚢 Build for Production

When ready to distribute:

```bash
# Build standalone APK (no Expo Go needed)
expo build:android -t apk

# Or for Google Play
expo build:android -t app-bundle
```

---

**You're all set! Scan the QR code and test the app on your phone! 🎉**
