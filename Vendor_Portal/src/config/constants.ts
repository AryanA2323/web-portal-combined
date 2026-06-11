import Constants from 'expo-constants';

const getApiBaseUrl = () => {
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
  
  if (expoHost) {
    return `http://${expoHost}:8000/api`;
  }
  
  return 'http://localhost:8000/api';
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || getApiBaseUrl();
export const API_TIMEOUT = 30000;

export const ENDPOINTS = {
  LOGIN: '/auth/login/',
  LOGOUT: '/auth/logout/',
  REFRESH_TOKEN: '/auth/refresh/',
  
  VENDOR_PROFILE: '/vendors/profile/',
  VENDOR_CASES: '/vendors/cases/',
  VENDOR_CASE_DETAIL: '/vendors/cases/{id}/',
  
  CASES: '/cases/',
  CASE_DETAIL: '/cases/{id}/',
};

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
};

export const APP_CONFIG = {
  TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};
