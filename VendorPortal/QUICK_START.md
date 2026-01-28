# Vendor Portal - Quick Start Guide

## What's Been Set Up

✅ React Native CLI project initialized
✅ Android development environment configured
✅ Project structure created
✅ Dependencies installed

## Project Structure

```
VendorPortal/
├── android/          # Android native code
├── ios/             # iOS native code (for future use)
├── __tests__/       # Test files
├── App.tsx          # Main app component
├── index.js         # Entry point
└── package.json     # Dependencies
```

## Prerequisites Checklist

Before running the app on your phone, make sure you have:

- [ ] Java Development Kit (JDK 17+) installed
- [ ] Android Studio installed with Android SDK
- [ ] ANDROID_HOME environment variable set
- [ ] USB Debugging enabled on your phone
- [ ] Phone connected via USB cable
- [ ] adb devices shows your phone

See `USB_DEVICE_SETUP.md` for detailed setup instructions.

## Running the App

### First Time Setup

1. **Check device connection:**
```powershell
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
adb devices
```

2. **Start Metro Bundler** (Terminal 1):
```powershell
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
npx react-native start
```

3. **Run on your phone** (Terminal 2):
```powershell
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
npx react-native run-android
```

### Subsequent Runs

Just repeat steps 2 and 3 above.

## Next Steps

1. Read `USB_DEVICE_SETUP.md` for detailed device setup
2. Customize `App.tsx` for your vendor portal features
3. Add navigation, API integration, and UI components
4. Test on your device regularly

## Common Commands

```powershell
# Check connected devices
adb devices

# Start Metro bundler
npx react-native start

# Run on Android device
npx react-native run-android

# Clear cache and rebuild
npx react-native start --reset-cache

# View logs
npx react-native log-android
```

## Support

For issues, refer to:
- `USB_DEVICE_SETUP.md` - Device setup and troubleshooting
- [React Native Docs](https://reactnative.dev/)
- [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting)
