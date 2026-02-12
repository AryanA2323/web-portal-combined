import Constants from 'expo-constants';

// Get the local IP address from Expo dev server
const getApiBaseUrl = () => {
  // In development, use the Expo dev server's host IP
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
  
  if (expoHost) {
    // Use the same IP as Expo dev server, but port 8000 for Django backend
    return `http://${expoHost}:8000/api`;
  }
  
  // Fallback to localhost (for web or if host detection fails)
  return 'http://localhost:8000/api';
};

// Backend API configuration
export const API_BASE_URL = getApiBaseUrl();
export const API_TIMEOUT = 30000; // 30 seconds

// API Endpoints
export const ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/auth/login/',
  LOGOUT: '/auth/logout/',
  REFRESH_TOKEN: '/auth/refresh/',
  
  // Vendor/User endpoints
  VENDOR_PROFILE: '/vendors/profile/',
  VENDOR_CASES: '/vendors/cases/',
  VENDOR_CASE_DETAIL: '/vendors/cases/{id}/',
  
  // Case endpoints (alternative endpoints)
  CASES: '/cases/',
  CASE_DETAIL: '/cases/{id}/',
};

// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
};

// App configuration
export const APP_CONFIG = {
  TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000, // 5 minutes buffer before actual expiry
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};
