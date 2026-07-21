import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import CompletedScreen from '@/screens/CompletedScreen';

export default function CompletedTab() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return null;
  }

  return <CompletedScreen />;
}
