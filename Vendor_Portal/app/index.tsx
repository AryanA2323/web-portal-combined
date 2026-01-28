import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useRouter } from 'expo-router';
import LoginScreen from './login';

export default function IndexScreen() {
  const router = useRouter();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  // Navigate to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  // Show login screen - will automatically navigate to dashboard if authenticated
  return <LoginScreen />;
}
