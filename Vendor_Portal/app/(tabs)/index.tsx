import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import DashboardScreen from '@/screens/DashboardScreen';

export default function HomeScreen() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <DashboardScreen />;
}
