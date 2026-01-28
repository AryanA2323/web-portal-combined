// Main Navigation Configuration

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import CasesScreen from '../screens/cases/CasesScreen';
import CaseDetailsScreen from '../screens/cases/CaseDetailsScreen';
import UploadPhotosScreen from '../screens/upload/UploadPhotosScreen';
import FillReportScreen from '../screens/forms/FillReportScreen';
import DataValidationScreen from '../screens/forms/DataValidationScreen';
import GenerateFormScreen from '../screens/forms/GenerateFormScreen';

const Stack = createNativeStackNavigator();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Cases" component={CasesScreen} />
            <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
            <Stack.Screen name="UploadPhotos" component={UploadPhotosScreen} />
            <Stack.Screen name="FillReport" component={FillReportScreen} />
            <Stack.Screen name="DataValidation" component={DataValidationScreen} />
            <Stack.Screen name="GenerateForm" component={GenerateFormScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
