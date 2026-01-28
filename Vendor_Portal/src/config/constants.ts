// Backend API configuration
export const API_BASE_URL = 'http://192.168.31.164:8000/api';
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
