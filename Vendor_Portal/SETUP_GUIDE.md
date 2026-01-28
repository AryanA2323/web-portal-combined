# Vendor Portal Mobile App - Setup & Running Guide

## Project Overview
The Vendor Portal is an Expo-based React Native mobile application built to allow vendors to:
- Login with their vendor credentials
- View a dashboard with all assigned cases
- Track case statuses and details

## Technology Stack
- **Frontend**: React Native + Expo
- **State Management**: Redux Toolkit
- **API Client**: Axios with interceptors for JWT token handling
- **Validation**: React Hook Form + Zod
- **Storage**: Expo Secure Store for token management
- **Navigation**: React Navigation (Stack Navigator)

## Backend Connection
The app connects to the Django backend running at:
- **API Base URL**: `http://192.168.31.164:8000/api`
- **Authentication**: Bearer token (JWT)
- **Endpoints**:
  - `POST /auth/login/` - Vendor login
  - `GET /cases/` - List all cases
  - `GET /vendors/{id}/cases/` - Vendor-specific cases

## Project Structure
```
Vendor_Portal/
├── src/
│   ├── config/              # Configuration files
│   │   ├── constants.ts      # API endpoints and storage keys
│   │   └── theme.ts          # UI theme and colors
│   ├── services/
│   │   └── api.ts            # Axios API service with interceptors
│   ├── store/                # Redux store
│   │   ├── authSlice.ts      # Authentication state
│   │   ├── casesSlice.ts     # Cases state
│   │   └── index.ts          # Store configuration
│   ├── screens/              # Screen components
│   │   ├── LoginScreen.tsx   # Login form
│   │   └── DashboardScreen.tsx # Cases dashboard
│   ├── components/
│   │   └── CommonComponents.tsx # Reusable UI components
│   ├── navigation/
│   │   └── RootNavigator.tsx # App navigation stack
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── App.tsx               # Root component
├── app/
│   └── _layout.tsx          # Expo Router entry point
├── app.json                  # Expo configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md
```

## Prerequisites
1. Node.js 18+ installed
2. Expo CLI: `npm install -g expo-cli`
3. Android device/emulator or iOS simulator
4. Laptop running Django backend on `192.168.31.164:8000`

## Installation & Setup

### 1. Install Dependencies
```bash
cd Vendor_Portal
npm install
```

### 2. Start Expo Development Server
```bash
npm start
```

This will display a QR code in the terminal.

### 3. Run on Physical Android Device

**Option A: Using Expo Go App**
1. Install "Expo Go" from Google Play Store on your Android phone
2. Make sure phone and laptop are on the same WiFi network (192.168.31.x)
3. Scan the QR code displayed in terminal with Expo Go
4. App will load and hot-reload automatically

**Option B: Build APK**
```bash
expo build:android -t apk
```

### 4. Run on Android Emulator
```bash
npm run android
```

## Testing the App

### Vendor Login Credentials
Ensure a vendor account exists in the Django backend. Example:
- **Email**: `vendor@example.com`
- **Password**: `password123`

### Test Workflow
1. **Launch App**: Scan QR code or start via npm
2. **Login**: Enter vendor email and password
3. **Dashboard**: View all assigned cases
4. **Refresh**: Pull down to refresh case list
5. **Logout**: Tap logout button in top-right corner

## Key Features Implemented

### 1. Authentication Flow
- Login form with email/password validation
- JWT token storage in Secure Store
- Automatic token refresh on 401 responses
- Secure logout with token cleanup

### 2. Case Management
- Display all cases assigned to vendor
- Show case status with color coding
- Display case details: number, title, description, priority
- Pull-to-refresh functionality
- Error handling and retry logic

### 3. State Management
- Redux store for auth and cases
- Async thunks for API calls
- Token persistence across app restarts
- Error state management

### 4. UI/UX
- Clean, modern Material Design components
- Responsive layout for different screen sizes
- Loading indicators and error messages
- Accessible form inputs with validation

## Environment Configuration

### Update API Endpoint
If your backend is running on a different IP/port, edit [src/config/constants.ts](src/config/constants.ts):

```typescript
export const API_BASE_URL = 'http://YOUR_IP:8000/api';
```

### Update Backend URL on Device
Ensure your device can reach the laptop:
1. Check laptop IP: `ipconfig | findstr IPv4`
2. Phone and laptop must be on same WiFi
3. Update API_BASE_URL with the IPv4 address

## Troubleshooting

### App Crashes on Startup
- Check browser console/terminal for errors
- Verify backend is running: `python manage.py runserver`
- Confirm API_BASE_URL is correct for your network

### Cannot Reach Backend
- Verify laptop IP with `ipconfig`
- Ensure phone and laptop on same WiFi (192.168.31.x)
- Check Django CORS settings include the phone IP
- Ping backend from laptop to verify it's running

### Login Fails
- Verify vendor account exists in Django admin
- Check email/password are correct
- Review backend logs for authentication errors
- Ensure JWT tokens are properly configured

### Cases Not Loading
- Verify vendor has cases assigned in database
- Check API endpoints in backend are accessible
- Review Redux store logs for fetch errors
- Ensure authentication token is being sent

## Backend CORS Configuration

Ensure your Django backend has CORS enabled. In `core/settings.py`:

```python
INSTALLED_APPS = [
    ...
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    ...
]

CORS_ALLOWED_ORIGINS = [
    'http://192.168.31.164:8081',  # Metro bundler
    'http://192.168.31.164:8000',  # API
]
```

## Development Features

### Hot Reload
Changes to `.tsx` and `.ts` files automatically reload on save.

### Redux DevTools (Optional)
Enable Redux middleware logging by uncommenting in `src/store/index.ts`.

### API Debugging
Monitor network requests by checking console logs in Expo Go.

## Building for Production

### Create APK
```bash
expo build:android -t apk
```

### Create AAB (for Google Play)
```bash
expo build:android -t app-bundle
```

## Next Steps
1. Implement case detail screen
2. Add case file/photo upload functionality
3. Add push notifications for case updates
4. Implement offline mode with local caching
5. Add case search and filter functionality

## Support
For issues or questions, check:
- Expo documentation: https://docs.expo.dev
- React Native docs: https://reactnative.dev
- Redux documentation: https://redux.js.org
