import Constants from 'expo-constants';

const PRODUCTION_API_BASE_URL = 'https://api.claimverify.shovelsolutions.in/api';

const getApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const normalizedEnvUrl = envUrl?.trim();

  if (__DEV__) {
    if (
      normalizedEnvUrl &&
      normalizedEnvUrl !== PRODUCTION_API_BASE_URL &&
      !normalizedEnvUrl.includes('loca.lt')
    ) {
      return normalizedEnvUrl;
    }

    const hostUri = Constants.expoConfig?.hostUri;
    
    // If we're using an Expo tunnel (.exp.direct), port 8000 won't be exposed through it.
    // We must connect to the local Wi-Fi IP directly.
    if (hostUri && !hostUri.includes('exp.direct') && !hostUri.includes('loca.lt')) {
      const expoHost = hostUri.split(':')[0];
      return `http://${expoHost}:8000/api`;
    }
    
    // Fallback to the current local Wi-Fi IP Address of the PC if tunnel is in use
    return 'http://192.168.1.2:8000/api';
  } else if (normalizedEnvUrl && !normalizedEnvUrl.includes('loca.lt')) {
    return normalizedEnvUrl;
  }

  const configuredApiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (
    typeof configuredApiBaseUrl === 'string' &&
    configuredApiBaseUrl.length > 0 &&
    !configuredApiBaseUrl.includes('loca.lt')
  ) {
    return configuredApiBaseUrl;
  }

  return PRODUCTION_API_BASE_URL;
};

export const API_BASE_URL = getApiBaseUrl();
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
