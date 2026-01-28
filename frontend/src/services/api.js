import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect to login if we're already on auth pages (login, register, reset password, etc.)
      const authPaths = ['/login', '/signup', '/register', '/forgot-password', '/reset-password', '/verify-2fa'];
      const currentPath = window.location.pathname;
      const isAuthPage = authPaths.some(path => currentPath.includes(path));
      
      // Don't redirect if it's an auth API call (login, register, etc.) or /auth/me call
      const isAuthApiCall = error.config?.url?.includes('/auth/login') || 
                            error.config?.url?.includes('/auth/register') ||
                            error.config?.url?.includes('/auth/password');
      
      // Only clear and redirect if we're on a protected page and it's not an auth API call
      if (!isAuthPage && !isAuthApiCall) {
        // Check if token exists - if not, user was never authenticated
        const token = localStorage.getItem('accessToken');
        if (token) {
          // Token exists but got 401 - it's invalid/expired
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          
          // Only redirect if not already redirecting
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
