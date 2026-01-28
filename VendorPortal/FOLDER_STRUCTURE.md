# Vendor Portal - Folder Structure Documentation

## Overview
This document provides a comprehensive explanation of the Vendor Portal mobile app's folder structure.

## Root Level

```
VendorPortal/
├── android/              # Android native code and configuration
├── ios/                  # iOS native code and configuration
├── node_modules/         # NPM dependencies
├── src/                  # Source code (main application code)
├── __tests__/           # Test files
├── App.tsx              # Main app entry point
├── index.js             # React Native entry point
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── babel.config.js      # Babel configuration
```

## Source Code Structure (`src/`)

### 📁 components/
Reusable UI components organized by feature or purpose.

```
src/components/
└── common/
    ├── Button.tsx           # Reusable button component
    ├── Input.tsx            # Form input component
    ├── CaseCard.tsx         # Card for displaying case information
    ├── Header.tsx           # Screen header component
    └── index.ts             # Component exports
```

**Purpose**: Common components are used across multiple screens to maintain consistency and reduce code duplication.

### 📁 context/
React Context providers for global state management.

```
src/context/
└── AuthContext.tsx          # Authentication state and methods
```

**Purpose**: Manages authentication state, user data, and auth-related functions throughout the app.

### 📁 navigation/
Navigation configuration and setup.

```
src/navigation/
└── AppNavigator.tsx         # Main navigation stack configuration
```

**Purpose**: Defines app navigation structure, screen routes, and navigation flow between authenticated and non-authenticated states.

### 📁 screens/
All application screens organized by feature.

```
src/screens/
├── auth/
│   └── LoginScreen.tsx              # Login/authentication screen
├── dashboard/
│   └── DashboardScreen.tsx          # Main dashboard with statistics
├── cases/
│   ├── CasesScreen.tsx              # Cases list with filters
│   └── CaseDetailsScreen.tsx        # Detailed case view
├── upload/
│   └── UploadPhotosScreen.tsx       # Photo upload with GPS tagging
└── forms/
    ├── FillReportScreen.tsx         # Incident report form
    ├── DataValidationScreen.tsx     # Report validation screen
    └── GenerateFormScreen.tsx       # Authorization form generator
```

**Screen Descriptions:**

#### auth/
- **LoginScreen**: Email/password authentication

#### dashboard/
- **DashboardScreen**: Shows case statistics, recent cases, and quick actions

#### cases/
- **CasesScreen**: Lists all assigned cases with filtering options
- **CaseDetailsScreen**: Displays comprehensive case information and action buttons

#### upload/
- **UploadPhotosScreen**: Camera/gallery integration with GPS location capture

#### forms/
- **FillReportScreen**: Form for entering observation, statement, date/time, and location
- **DataValidationScreen**: Reviews entered data and shows validation warnings
- **GenerateFormScreen**: Creates PDF authorization forms

### 📁 services/
API integration and external service handlers.

```
src/services/
└── api.ts                   # Axios instance, API endpoints, service functions
```

**Service Functions:**
- `authService`: Login, logout, authentication checks
- `caseService`: Case CRUD operations, statistics
- `photoService`: Photo uploads with GPS data
- `reportService`: Report submission, validation, PDF generation
- `notificationService`: Notifications management

### 📁 types/
TypeScript type definitions and interfaces.

```
src/types/
└── index.ts                 # All TypeScript interfaces
```

**Defined Types:**
- `User`: User profile and authentication data
- `Case`: Case information and status
- `Photo`: Image data with GPS coordinates
- `IncidentReport`: Report form data
- `ValidationWarning`: Validation messages
- `CaseStatistics`: Dashboard statistics
- `Notification`: Notification data

### 📁 utils/
Utility functions, constants, and helpers.

```
src/utils/
└── constants.ts             # App-wide constants and configuration
```

**Constants Include:**
- `API_BASE_URL`: Backend API endpoint
- `COLORS`: App color palette
- `STATUS_COLORS`: Case status color mapping
- `CASE_TYPES`: Case type definitions
- `STORAGE_KEYS`: AsyncStorage key names
- `ROUTES`: Navigation route names
- `ENDPOINTS`: API endpoint paths

### 📁 assets/
Static resources (currently empty, ready for images, fonts, etc.)

```
src/assets/
└── (images, icons, fonts will go here)
```

## Android Configuration

### Key Android Files

```
android/
├── app/
│   └── src/
│       └── main/
│           └── AndroidManifest.xml  # Android permissions and configuration
└── build.gradle                      # Android build configuration
```

**AndroidManifest.xml Permissions:**
- `INTERNET`: API communication
- `CAMERA`: Taking photos
- `READ_EXTERNAL_STORAGE`: Gallery access
- `WRITE_EXTERNAL_STORAGE`: Photo storage
- `ACCESS_FINE_LOCATION`: GPS tagging
- `ACCESS_COARSE_LOCATION`: Location services

## Configuration Files

### package.json
Defines project dependencies and npm scripts:
- `npm start`: Start Metro bundler
- `npm run android`: Run on Android device/emulator
- `npm run ios`: Run on iOS device/simulator
- `npm test`: Run tests

### tsconfig.json
TypeScript compiler configuration for type checking and compilation.

### babel.config.js
Babel transformer configuration for React Native.

## Data Flow

```
User Action
    ↓
Screen Component
    ↓
Service Function (api.ts)
    ↓
Axios HTTP Request
    ↓
Django Backend API
    ↓
Response Processing
    ↓
State Update (Context/Local State)
    ↓
UI Re-render
```

## Navigation Flow

```
App.tsx
    ↓
AuthProvider
    ↓
AppNavigator
    ├── Not Authenticated → LoginScreen
    └── Authenticated
        ├── DashboardScreen
        ├── CasesScreen → CaseDetailsScreen
        ├── UploadPhotosScreen
        ├── FillReportScreen → DataValidationScreen
        └── GenerateFormScreen
```

## Best Practices

### File Organization
- **One component per file**: Easy to locate and maintain
- **Index files**: Simplify imports from folders
- **Logical grouping**: Related files in same directory

### Naming Conventions
- **Components**: PascalCase (e.g., `LoginScreen.tsx`)
- **Services**: camelCase (e.g., `authService`)
- **Types**: PascalCase (e.g., `User`, `Case`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

### Import Structure
```typescript
// 1. External libraries
import React from 'react';
import { View } from 'react-native';

// 2. Internal modules
import { Button } from '../../components/common';
import { caseService } from '../../services/api';

// 3. Types
import type { Case } from '../../types';
```

## Adding New Features

### New Screen
1. Create screen file in appropriate `screens/` subdirectory
2. Add route to `AppNavigator.tsx`
3. Add route constant to `utils/constants.ts`

### New API Endpoint
1. Add endpoint constant to `utils/constants.ts`
2. Create service function in `services/api.ts`
3. Define response types in `types/index.ts`

### New Component
1. Create component in `components/common/` or feature-specific folder
2. Export from `index.ts` in component directory
3. Document props with TypeScript interface

## Testing Structure

```
__tests__/
├── components/
├── screens/
├── services/
└── utils/
```

Tests should mirror the source structure for easy navigation.

---

This structure provides:
- ✅ Clear separation of concerns
- ✅ Easy to navigate and understand
- ✅ Scalable for future features
- ✅ Consistent patterns throughout
- ✅ TypeScript type safety
