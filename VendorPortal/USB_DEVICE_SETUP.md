# USB Device Setup Guide for Vendor Portal

## Prerequisites

### 1. Enable Developer Options on Your Android Phone
1. Go to **Settings** → **About Phone**
2. Tap on **Build Number** 7 times to enable Developer Mode
3. Go back to **Settings** → **System** → **Developer Options**
4. Enable **USB Debugging**
5. Enable **Install via USB** (if available)

### 2. Install Required Software on Your Laptop

#### Java Development Kit (JDK)
- Download and install JDK 17 or later from [Oracle](https://www.oracle.com/java/technologies/downloads/) or [Adoptium](https://adoptium.net/)
- Set JAVA_HOME environment variable

#### Android Studio
1. Download [Android Studio](https://developer.android.com/studio)
2. During installation, make sure to install:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device
   - Android SDK Build-Tools

#### Configure Android SDK
1. Open Android Studio
2. Go to **Settings** → **Languages & Frameworks** → **Android SDK**
3. Install:
   - Android SDK Platform 34 (or latest)
   - Android SDK Build-Tools 34.0.0 (or latest)
   - Android SDK Command-line Tools
   - Android SDK Platform-Tools
   - Android Emulator

#### Set Environment Variables
Add these to your System Environment Variables:

```
ANDROID_HOME = C:\Users\<YourUsername>\AppData\Local\Android\Sdk
```

Add to PATH:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
```

## Running the App on Your USB-Connected Phone

### Step 1: Connect Your Phone
1. Connect your Android phone to your laptop via USB cable
2. On your phone, when prompted, select **"Transfer files"** or **"File Transfer"** mode
3. Allow USB debugging when the prompt appears on your phone

### Step 2: Verify Device Connection
Open PowerShell and run:
```powershell
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
adb devices
```

You should see your device listed like:
```
List of devices attached
ABC123456789    device
```

If you see "unauthorized", check your phone for the USB debugging authorization prompt.

### Step 3: Start Metro Bundler
In a PowerShell terminal:
```powershell
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
npx react-native start
```

Keep this terminal running.

### Step 4: Run the App on Your Device
In a NEW PowerShell terminal:
```powershell
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
npx react-native run-android
```

The app will be installed and launched on your phone automatically.

## Troubleshooting

### Device Not Detected
- Make sure USB debugging is enabled
- Try a different USB cable (some cables are charge-only)
- Try a different USB port
- Revoke USB debugging authorizations in Developer Options and try again
- Install USB drivers for your phone manufacturer

### Build Errors
If you get Gradle errors:
```powershell
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### Metro Bundler Issues
Reset the cache:
```powershell
npx react-native start --reset-cache
```

### Port Already in Use
Kill the process using port 8081:
```powershell
netstat -ano | findstr :8081
taskkill /PID <PID> /F
```

### App Not Installing
Clear the app data on your phone:
1. Go to **Settings** → **Apps** → **VendorPortal**
2. Tap **Storage** → **Clear Data**
3. Uninstall the app
4. Run `npx react-native run-android` again

## Quick Start Commands

After initial setup, to run the app:

```powershell
# Terminal 1 - Start Metro Bundler
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
npx react-native start

# Terminal 2 - Run on device
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
npx react-native run-android
```

## Development Tips

### Live Reload
- Shake your phone or press Ctrl+M in the emulator
- Enable "Fast Refresh" for automatic reloading

### Debug Menu
- Shake your device or run: `adb shell input keyevent 82`
- Select "Debug" to open Chrome DevTools

### View Logs
```powershell
npx react-native log-android
```

or

```powershell
adb logcat
```

## Additional Resources
- [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)
- [Running on Device](https://reactnative.dev/docs/running-on-device)
- [Debugging](https://reactnative.dev/docs/debugging)
