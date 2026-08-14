import api from './api';
import { authStorage } from '../utils/authStorage';

// Auth service for handling authentication operations
const authService = {
  // Register new user
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      
      // Store token and user data
      if (response.data.token) {
        authStorage.setItem('accessToken', response.data.token.token);
        authStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Registration failed. Please try again.' };
    }
  },

  // Login function
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        username: email,  // Backend expects 'username' field which can be email
        password,
      });
      
      // Check for 2FA required response (202 status)
      if (response.status === 202) {
        return { 
          requires2FA: true, 
          message: response.data.message,
          username: response.data.username,
        };
      }
      
      const userData = response.data.user;
      
      // Backend returns token object and user info
      if (response.data.token) {
        authStorage.setItem('accessToken', response.data.token.token);
        authStorage.setItem('user', JSON.stringify(userData));
      }
      
      return { ...response.data, user: userData };
    } catch (error) {
      throw error.response?.data || { error: 'Login failed. Please try again.' };
    }
  },

  // Login with 2FA code
  loginWith2FA: async (email, password, code) => {
    try {
      const response = await api.post('/auth/login', {
        username: email,
        password,
        code,
      });
      
      const userData = response.data.user;
      
      if (response.data.token) {
        authStorage.setItem('accessToken', response.data.token.token);
        authStorage.setItem('user', JSON.stringify(userData));
      }
      
      return { ...response.data, user: userData };
    } catch (error) {
      throw error.response?.data || { error: 'Login failed. Please try again.' };
    }
  },

  // Resend 2FA code
  resend2FACode: async (email, password) => {
    try {
      const response = await api.post('/auth/login/resend-2fa', {
        username: email,
        password,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to resend code.' };
    }
  },

  // Forgot password - request reset code
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/password/forgot', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to send reset code.' };
    }
  },

  // Verify reset code
  verifyResetCode: async (email, code) => {
    try {
      const response = await api.post('/auth/password/verify-code', { email, code });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Invalid or expired code.' };
    }
  },

  // Reset password with code
  resetPassword: async (email, code, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/auth/password/reset', {
        email,
        code,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to reset password.' };
    }
  },

  // Reset password with token (from link)
  resetPasswordWithToken: async (token, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/auth/password/reset/token', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to reset password.' };
    }
  },

  // Logout function
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      authStorage.clearAuth();
    }
  },

  // Get current user
  getCurrentUser: () => {
    const user = authStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!authStorage.getItem('accessToken');
  },
};

export default authService;
