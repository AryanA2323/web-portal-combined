import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import api from '../services/api';
import { authStorage } from '../utils/authStorage';

// Create context
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = authService.getCurrentUser();
        if (storedUser && authService.isAuthenticated()) {
          setUser(storedUser);
          // Fetch fresh user data from backend (picks up permission changes)
          try {
            const response = await api.get('/auth/me');
            if (response.data) {
              authService.updateStoredUser(response.data);
              setUser(response.data);
            }
          } catch (refreshErr) {
            // If token is invalid/expired, keep stale data until next action
            if (refreshErr.response?.status === 401) {
              authService.logout();
              setUser(null);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        authService.logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // ── Session Lifecycle: Heartbeat ──
  // The frontend pings the backend every 30s to keep `last_used_at` fresh.
  // When the browser/tab is closed, the heartbeat stops. The backend
  // auto-deactivates sessions with no heartbeat for 3+ minutes.
  // This is the same pattern used by Netflix, Spotify, etc.
  useEffect(() => {
    let heartbeatInterval = null;

    const startHeartbeat = () => {
      // Send an initial heartbeat immediately on mount
      const token = authStorage.getItem('accessToken');
      if (token) {
        api.post('/auth/heartbeat').catch(() => {});
      }

      heartbeatInterval = setInterval(() => {
        const t = authStorage.getItem('accessToken');
        if (!t) return;
        api.post('/auth/heartbeat').catch(() => {});
      }, 5_000); // every 5 seconds
    };

    startHeartbeat();

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, []);

  // Refresh user data function
  const refreshUser = useCallback(async () => {
    if (!authService.isAuthenticated()) return null;
    
    try {
      // Create a temporary endpoint in backend for this, 
      // or just re-fetch user details if an endpoint exists
      const response = await api.get('/auth/me');
      if (response.data) {
        // Update local storage and state
        authService.updateStoredUser(response.data);
        setUser(response.data);
        return response.data;
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
      // If unauthorized, might need to logout
      if (err.response?.status === 401) {
        logout();
      }
    }
    return null;
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
      
      // Set user from tab-scoped sessionStorage after successful login
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
      
      // Set user from tab-scoped sessionStorage after successful 2FA login
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
  const logout = async () => {
    await authService.logout();
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
