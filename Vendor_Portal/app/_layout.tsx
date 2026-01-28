import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { restoreToken } from '@/store/authSlice';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '@/config/theme';
import 'react-native-reanimated';

function RootLayoutContent() {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Try to restore token from storage on app startup
    dispatch(restoreToken());
  }, [dispatch]);

  if (isLoading) {
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
        <RootLayoutContent />
      </Provider>
    </SafeAreaProvider>
  );
}
