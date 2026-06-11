import React, { useEffect, useRef, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState, AppDispatch } from '@/store';
import { restoreToken } from '@/store/authSlice';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '@/config/theme';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenCapture from 'expo-screen-capture';
import { addNotificationResponseListener, registerForPushNotifications } from '@/services/pushNotifications';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const [appIsReady, setAppIsReady] = useState(false);
  const pushRegisteredRef = useRef(false);

  useEffect(() => {
    async function prepare() {
      try {
        await dispatch(restoreToken());
      } catch (e) {
        console.warn('Error loading app:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, [dispatch]);

  useEffect(() => {
    if (appIsReady && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady, isLoading]);

  useEffect(() => {
    if (isLoading || !appIsReady) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const isLoginRoute = segments[0] === undefined;
    const isPublicRoute = segments[0] === 'login';

    const timer = setTimeout(() => {
      if (!isAuthenticated && inAuthGroup) {
        router.replace('/');
      } else if (isAuthenticated && (isLoginRoute || isPublicRoute)) {
        router.replace('/(tabs)');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [appIsReady, isAuthenticated, isLoading, router, segments]);

  useEffect(() => {
    const subscription = addNotificationResponseListener((caseId, checkType) => {
      router.push({
        pathname: '/case-details',
        params: { caseId, checkType },
      });
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated || pushRegisteredRef.current) return;

    pushRegisteredRef.current = true;
    registerForPushNotifications().catch((error) => {
      pushRegisteredRef.current = false;
      console.warn('Push notification registration failed:', error);
    });
  }, [isAuthenticated]);

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
      }}
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    ScreenCapture.allowScreenCaptureAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <StatusBar style="dark" translucent={false} />
        <RootNavigator />
      </Provider>
    </SafeAreaProvider>
  );
}
