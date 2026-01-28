# Vendor Portal Mobile App

A React Native mobile application for vendors to manage incident cases, upload geotagged evidence, and submit reports.

## 📱 Features

### Dashboard
- View assigned cases and statistics
- Quick access to pending submissions
- Real-time case status updates
- Case statistics (New, In Progress, Completed)

### Case Management
- Browse all assigned cases
- Filter cases by status (New, In Progress, Completed)
- View detailed case information
- Access case location on map

### Evidence Upload
- Capture photos with device camera
- Select photos from gallery
- Automatic GPS tagging for location verification
- Multi-photo upload support
- GPS data validation

### Incident Reporting
- Fill detailed incident reports
- Add observations and witness statements
- Record date, time, and location
- Data validation before submission
- Location mismatch detection

### Form Generation
- Generate authorization forms
- Client information capture
- PDF export functionality

## 🏗️ Project Structure

```
VendorPortal/
├── src/
│   ├── components/
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── CaseCard.tsx
│   │       └── Header.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── navigation/
│   │   └── AppNavigator.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   └── LoginScreen.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardScreen.tsx
│   │   ├── cases/
│   │   │   ├── CasesScreen.tsx
│   │   │   └── CaseDetailsScreen.tsx
│   │   ├── upload/
│   │   │   └── UploadPhotosScreen.tsx
│   │   └── forms/
│   │       ├── FillReportScreen.tsx
│   │       ├── DataValidationScreen.tsx
│   │       └── GenerateFormScreen.tsx
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── constants.ts
├── android/
├── ios/
└── App.tsx
```

## 🔧 Tech Stack

- **Framework**: React Native 0.83.1
- **Language**: TypeScript
- **Navigation**: React Navigation 6
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Storage**: AsyncStorage
- **Image Picker**: react-native-image-picker
- **Geolocation**: react-native-geolocation-service
- **Maps**: react-native-maps

## 🚀 Setup Instructions

### Prerequisites

1. **Node.js** (v18 or later)
2. **Java Development Kit** (JDK 17 or later)
3. **Android Studio** with Android SDK
4. **React Native CLI**

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd "D:\ShovelTech Project\vendor_portal\VendorPortal"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install iOS dependencies** (Mac only):
   ```bash
   cd ios
   pod install
   cd ..
   ```

### Android Setup

1. **Set environment variables:**
   ```
   ANDROID_HOME = C:\Users\<YourUsername>\AppData\Local\Android\Sdk
   ```

2. **Add to PATH:**
   ```
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\tools
   ```

### Backend Configuration

Update the API URL in `src/utils/constants.ts`:

```typescript
// For Android Emulator
export const API_BASE_URL = 'http://10.0.2.2:8000/api';

// For Physical Device (replace with your computer's IP)
export const API_BASE_URL = 'http://192.168.1.100:8000/api';
```

## 📲 Running the App

### On USB-Connected Android Device

1. **Enable USB Debugging on your phone**
2. **Connect phone via USB**
3. **Verify connection:**
   ```bash
   adb devices
   ```

4. **Start Metro Bundler** (Terminal 1):
   ```bash
   npm start
   ```

5. **Run on device** (Terminal 2):
   ```bash
   npm run android
   ```

### On Android Emulator

1. **Start Android Emulator from Android Studio**
2. **Run the app:**
   ```bash
   npm run android
   ```

## 🔐 Authentication

The app uses token-based authentication with the Django backend.

**Login Credentials:**
- Use credentials from the incident management platform
- Vendors only (role-based access)

## 🌐 API Integration

The app integrates with the Django backend at:
- **Development**: `http://localhost:8000/api` (emulator) or `http://<YOUR_IP>:8000/api` (physical device)

### Available Endpoints:
- `POST /api/auth/login/` - User authentication
- `GET /api/cases/` - Get all cases
- `GET /api/cases/{id}/` - Get case details
- `POST /api/cases/upload-photo/` - Upload photos
- `POST /api/cases/submit-report/` - Submit incident report
- `GET /api/notifications/` - Get notifications

## 📸 Permissions

The app requires the following permissions:
- **Camera**: For taking photos
- **Gallery**: For selecting photos
- **Location**: For GPS tagging
- **Internet**: For API communication

## 🐛 Troubleshooting

### Metro Bundler Issues
```bash
npx react-native start --reset-cache
```

### Build Errors
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Device Not Detected
- Check USB debugging is enabled
- Try different USB cable/port
- Install device drivers
- Run: `adb kill-server && adb start-server`

### Location Not Working
- Enable location services on device
- Grant location permissions in app settings
- Check GPS signal

## 📝 Development

### Adding New Screens
1. Create screen component in `src/screens/`
2. Add route to `src/navigation/AppNavigator.tsx`
3. Update types in `src/types/index.ts` if needed

### Adding New API Endpoints
1. Add endpoint constant in `src/utils/constants.ts`
2. Create service function in `src/services/api.ts`

### Styling
- Use consistent colors from `src/utils/constants.ts`
- Follow existing component patterns
- Maintain responsive design

## 🔄 Workflow

1. **Login** → Vendor authenticates
2. **Dashboard** → View cases and statistics
3. **Case Details** → Select a case
4. **Upload Photos** → Add geotagged evidence
5. **Fill Report** → Complete incident details
6. **Validation** → Review and fix warnings
7. **Submit** → Send report to backend

## 📦 Build for Production

### Android APK
```bash
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/`

### Android AAB (Google Play)
```bash
cd android
./gradlew bundleRelease
```

## 🤝 Integration with Backend

This mobile app works seamlessly with the Django incident management platform located in the `incident-management-platform` folder. No changes were made to the backend - the app consumes existing APIs.

## 📄 License

See LICENSE file in the project root.

## 👥 Support

For issues or questions, refer to:
- `USB_DEVICE_SETUP.md` - Device setup guide
- `QUICK_START.md` - Quick reference
- Django backend documentation

---

**Version**: 1.0.0  
**Last Updated**: January 20, 2026
