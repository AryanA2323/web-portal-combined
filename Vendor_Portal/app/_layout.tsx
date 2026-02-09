import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { restoreToken } from '@/store/authSlice';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '@/config/theme';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Try to restore token from storage on app startup
        await dispatch(restoreToken());
      } catch (e) {
        console.warn('Error loading app:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady && !isLoading) {
      // Hide the splash screen after the app is ready
      SplashScreen.hideAsync();
    }
  }, [appIsReady, isLoading]);

  useEffect(() => {
    if (appIsReady && !isLoading) {
      // Hide the splash screen after the app is ready
      SplashScreen.hideAsync();
    }
  }, [appIsReady, isLoading]);

  useEffect(() => {
    if (isLoading || !appIsReady) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const isLoginRoute = segments[0] === undefined || segments.length === 0;
    const isPublicRoute = segments[0] === 'login';
    
    // Routes that authenticated users can access
    const allowedAuthRoutes = ['upload-evidence', 'incident', '(tabs)'];
    const currentRoute = segments[0];

    // Use setTimeout to avoid navigation during render
    const timer = setTimeout(() => {
      if (!isAuthenticated && inAuthGroup) {
        // User is not authenticated but in protected route, redirect to login
        router.replace('/');
      } else if (isAuthenticated && (isLoginRoute || isPublicRoute)) {
        // User is authenticated but on login screen, redirect to tabs
        router.replace('/(tabs)');
      }
      // Don't redirect authenticated users from allowed routes
    }, 0);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, segments, appIsReady]);

  if (!appIsReady || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <StatusBar barStyle="dark-content" translucent={false} />
        <RootNavigator />
      </Provider>
    </SafeAreaProvider>
  );
}
