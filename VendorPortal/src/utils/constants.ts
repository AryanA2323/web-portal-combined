// Constants for Vendor Portal

// API Configuration
export const API_BASE_URL = 'http://192.168.31.164:8000/api'; // Using WiFi network
// For Android emulator, use: 'http://10.0.2.2:8000/api'
// For ADB reverse port forwarding, use: 'http://localhost:8000/api'

// Colors
export const COLORS = {
  primary: '#4267B2',
  secondary: '#6c757d',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  info: '#17a2b8',
  light: '#f8f9fa',
  dark: '#343a40',
  white: '#ffffff',
  black: '#000000',
  gray: '#6c757d',
  lightGray: '#e9ecef',
  background: '#f5f5f5',
};

// Status Colors
export const STATUS_COLORS = {
  new: '#17a2b8',
  in_progress: '#28a745',
  completed: '#6c757d',
  awaiting_submission: '#ffc107',
};

// Case Types
export const CASE_TYPES = {
  collision: 'Collision',
  fire_damage: 'Fire Damage',
  water_leak: 'Water Leak',
  theft: 'Theft Investigation',
  accident: 'Accident Report',
  fraud: 'Fraud Inquiry',
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@vendor_portal_token',
  USER_DATA: '@vendor_portal_user',
  OFFLINE_DATA: '@vendor_portal_offline',
};

// Navigation Routes
export const ROUTES = {
  // Auth
  LOGIN: 'Login',
  
  // Main Tabs
  DASHBOARD: 'Dashboard',
  CASES: 'Cases',
  UPLOAD_EVIDENCE: 'UploadEvidence',
  FORMS: 'Forms',
  
  // Case Screens
  CASE_DETAILS: 'CaseDetails',
  UPLOAD_PHOTOS: 'UploadPhotos',
  INCIDENT_REPORT: 'IncidentReport',
  FILL_REPORT: 'FillReport',
  GENERATE_FORM: 'GenerateForm',
  DATA_VALIDATION: 'DataValidation',
  INVESTIGATION_REPORT: 'InvestigationReport',
  
  // Other
  NOTIFICATIONS: 'Notifications',
  PROFILE: 'Profile',
};

// API Endpoints
export const ENDPOINTS = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  CASES: '/cases',
  UPLOAD_PHOTO: '/cases/upload-photo',
  SUBMIT_REPORT: '/cases/submit-report',
  NOTIFICATIONS: '/notifications',
};
