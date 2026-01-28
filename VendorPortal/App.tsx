/**
 * Vendor Portal Mobile App
 * Main entry point
 */

import React from 'react';
import { StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor="#4267B2" />
      <AppNavigator />
    </AuthProvider>
  );
}

export default App;
