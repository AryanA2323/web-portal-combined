import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services';
import api from '../services/api';

// Create Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch fresh user data from server
  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        return null;
      }
      
      const response = await api.get('/auth/me');
      const freshUser = response.data;
      localStorage.setItem('user', JSON.stringify(freshUser));
      setUser(freshUser);
      return freshUser;
    } catch (err) {
      console.error('Failed to refresh user data:', err);
      // Don't clear auth on refresh failure - user might still be valid
      return user; // Return current user
    }
  };

  // Initialize auth state from localStorage and refresh from server
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = authService.getCurrentUser();
        const token = localStorage.getItem('accessToken');
        
        if (storedUser && token) {
          setUser(storedUser);
          // Don't refresh immediately - user data from login is fresh enough
          // Only refresh if needed or after some time
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    setError(null);
    try {
      const data = await authService.login(email, password);
      
      // If 2FA is required, return the response without setting user
      if (data.requires2FA) {
        return data;
      }
      
      // Set user from localStorage after successful login
      const storedUser = authService.getCurrentUser();
      
      // Ensure user data is valid before setting
      if (!storedUser) {
        throw new Error('Failed to retrieve user data after login');
      }
      
      setUser(storedUser);
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return data;
    } catch (err) {
      const errorMessage = err.error || err.message || 'Login failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Complete 2FA login
  const complete2FALogin = async (email, password, code) => {
    setError(null);
    try {
      const data = await authService.loginWith2FA(email, password, code);
      
      // Set user from localStorage after successful 2FA login
      const storedUser = authService.getCurrentUser();
      setUser(storedUser);
      return data;
    } catch (err) {
      const errorMessage = err.error || err.message || '2FA verification failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Logout function
  const logout = () => {
    authService.logout();
    setUser(null);
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    login,
    complete2FALogin,
    logout,
    refreshUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
