# Development Guide - Vendor Portal

## Getting Started

### Initial Setup
1. Review `QUICK_START.md` for basic setup
2. Read `USB_DEVICE_SETUP.md` for device configuration
3. Check `PROJECT_README.md` for comprehensive documentation

### Development Environment

#### Required Tools
- Node.js 18+
- Android Studio
- VS Code (recommended)
- Git

#### Recommended VS Code Extensions
- ES7+ React/Redux/React-Native snippets
- TypeScript React code snippets
- Prettier - Code formatter
- ESLint

## Running for Development

### First Time Setup
```bash
# Navigate to project
cd "D:\ShovelTech Project\vendor_portal\VendorPortal"

# Install dependencies
npm install

# Check device connection
adb devices
```

### Daily Development Workflow

#### Terminal 1 - Metro Bundler
```bash
npm start
# or
npm start -- --reset-cache  # if having cache issues
```

#### Terminal 2 - Run on Device
```bash
npm run android
```

### Hot Reload
The app supports Fast Refresh. Changes to most files will automatically update on the device.

## Code Style Guidelines

### TypeScript
- Use interfaces for type definitions
- Avoid `any` type
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### React Components
```typescript
// Functional components with TypeScript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MyComponentProps {
  title: string;
  onPress?: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, onPress }) => {
  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

export default MyComponent;
```

### Naming Conventions
- Components: PascalCase (`LoginScreen.tsx`)
- Functions: camelCase (`handleSubmit`)
- Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)
- Types/Interfaces: PascalCase (`User`, `CaseData`)

## API Integration

### Changing Backend URL

For development on physical device:
1. Find your computer's IP address:
   ```bash
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```

2. Update in `src/utils/constants.ts`:
   ```typescript
   export const API_BASE_URL = 'http://192.168.1.100:8000/api';
   ```

3. Ensure Django backend allows this host in `settings.py`:
   ```python
   ALLOWED_HOSTS = ['192.168.1.100', 'localhost']
   ```

### Testing API Calls

Use the Django backend running on your laptop:
```bash
# In incident-management-platform folder
python manage.py runserver 0.0.0.0:8000
```

## Debugging

### React Native Debugger
1. Shake device or press `Ctrl+M` in emulator
2. Select "Debug"
3. Opens Chrome DevTools

### Viewing Logs
```bash
# Android logs
npx react-native log-android

# or
adb logcat | grep ReactNative
```

### Console Logs
```typescript
console.log('Debug info:', data);
console.error('Error occurred:', error);
console.warn('Warning:', warning);
```

## Common Development Tasks

### Adding a New Screen

1. Create screen file:
```bash
# Example: ProfileScreen
src/screens/profile/ProfileScreen.tsx
```

2. Add to navigator:
```typescript
// src/navigation/AppNavigator.tsx
import ProfileScreen from '../screens/profile/ProfileScreen';

// In Stack.Navigator
<Stack.Screen name="Profile" component={ProfileScreen} />
```

3. Navigate to it:
```typescript
navigation.navigate('Profile');
```

### Adding a New API Endpoint

1. Add endpoint constant:
```typescript
// src/utils/constants.ts
export const ENDPOINTS = {
  // ... existing endpoints
  PROFILE: '/users/profile/',
};
```

2. Create service function:
```typescript
// src/services/api.ts
export const userService = {
  getProfile: async () => {
    const response = await api.get(ENDPOINTS.PROFILE);
    return response.data;
  },
};
```

3. Use in component:
```typescript
import { userService } from '../../services/api';

const loadProfile = async () => {
  const profile = await userService.getProfile();
  setProfile(profile);
};
```

### Adding a New Type

```typescript
// src/types/index.ts
export interface Profile {
  id: number;
  bio: string;
  avatar?: string;
}
```

## Styling Best Practices

### Use Constants
```typescript
import { COLORS } from '../../utils/constants';

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,  // Don't hardcode colors
  },
});
```

### Responsive Design
```typescript
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: width * 0.9,  // 90% of screen width
  },
});
```

## Testing

### Running Tests
```bash
npm test
```

### Writing Tests
```typescript
// __tests__/services/api.test.ts
import { authService } from '../../src/services/api';

describe('authService', () => {
  it('should login successfully', async () => {
    const result = await authService.login('test@example.com', 'password');
    expect(result.token).toBeDefined();
  });
});
```

## Performance Tips

### Optimize Images
- Use appropriate image sizes
- Compress images before uploading
- Use `resizeMode` prop wisely

### Avoid Unnecessary Re-renders
```typescript
// Use React.memo for components
const MyComponent = React.memo(({ data }) => {
  return <View>{data}</View>;
});

// Use useCallback for functions
const handlePress = useCallback(() => {
  doSomething();
}, [dependency]);
```

### Lazy Loading
```typescript
// Load data only when needed
useEffect(() => {
  if (screenVisible) {
    loadData();
  }
}, [screenVisible]);
```

## Error Handling

### API Errors
```typescript
try {
  const data = await caseService.getCases();
  setCases(data);
} catch (error: any) {
  if (error.response?.status === 401) {
    // Unauthorized
    navigation.navigate('Login');
  } else {
    Alert.alert('Error', 'Failed to load cases');
  }
}
```

### Form Validation
```typescript
const validateForm = () => {
  if (!email || !password) {
    Alert.alert('Error', 'Please fill all fields');
    return false;
  }
  
  if (!isValidEmail(email)) {
    Alert.alert('Error', 'Invalid email format');
    return false;
  }
  
  return true;
};
```

## Git Workflow

### Committing Changes
```bash
git add .
git commit -m "feat: add profile screen"
git push origin feature/profile-screen
```

### Commit Message Format
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

## Troubleshooting

### App Won't Start
1. Clear cache: `npm start -- --reset-cache`
2. Clean build: `cd android && ./gradlew clean`
3. Reinstall modules: `rm -rf node_modules && npm install`

### GPS Not Working
1. Check permissions in AndroidManifest.xml
2. Enable location on device
3. Grant app permissions in device settings

### Photos Not Uploading
1. Check camera/storage permissions
2. Verify network connection
3. Check backend API is running
4. Review file size limits

## Resources

### Official Documentation
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Internal Documentation
- `PROJECT_README.md` - Full project overview
- `FOLDER_STRUCTURE.md` - Code organization
- `USB_DEVICE_SETUP.md` - Device setup guide
- `QUICK_START.md` - Quick reference

### Community
- [React Native Community](https://github.com/react-native-community)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/react-native)

---

Happy coding! 🚀
