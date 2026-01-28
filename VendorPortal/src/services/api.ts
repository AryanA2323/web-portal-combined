// API Service for Vendor Portal

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, STORAGE_KEYS, ENDPOINTS } from '../utils/constants';
import type { User, Case, Photo, IncidentReport, Notification } from '../types';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Token ${token}`;
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
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      // Navigate to login (handled in AuthContext)
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authService = {
  login: async (email: string, password: string) => {
    try {
      const payload = { 
        username: email, 
        password
      };
      
      console.log('Login attempt:', { username: email });
      console.log('API URL:', `${API_BASE_URL}${ENDPOINTS.LOGIN}`);
      
      const response = await api.post(ENDPOINTS.LOGIN, payload);
      
      console.log('Login response status:', response.status);
      console.log('Login response data:', response.data);
      
      // Login successful with token
      const { token, user } = response.data;
      
      if (token && token.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      }
      
      return { token: token.token, user };
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Format error for better handling
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Invalid credentials';
      
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    try {
      await api.post(ENDPOINTS.LOGOUT);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    const userString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userString ? JSON.parse(userString) : null;
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  },
};

// Case Services
export const caseService = {
  getCases: async (status?: string): Promise<Case[]> => {
    const params = status ? { status } : {};
    const response = await api.get(ENDPOINTS.CASES, { params });
    return response.data;
  },

  getCaseById: async (id: number): Promise<Case> => {
    const response = await api.get(`${ENDPOINTS.CASES}${id}/`);
    return response.data;
  },

  getCaseStatistics: async () => {
    const response = await api.get(`${ENDPOINTS.CASES}statistics/`);
    return response.data;
  },

  updateCaseStatus: async (caseId: number, status: string) => {
    const response = await api.patch(`${ENDPOINTS.CASES}${caseId}/`, { status });
    return response.data;
  },
};

// Photo Upload Services
export const photoService = {
  uploadPhoto: async (caseId: number, photo: Photo) => {
    const formData = new FormData();
    formData.append('case', caseId.toString());
    formData.append('photo', {
      uri: photo.uri,
      type: photo.type,
      name: photo.fileName,
    } as any);
    
    if (photo.latitude && photo.longitude) {
      formData.append('latitude', photo.latitude.toString());
      formData.append('longitude', photo.longitude.toString());
    }

    const response = await api.post(ENDPOINTS.UPLOAD_PHOTO, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  uploadMultiplePhotos: async (caseId: number, photos: Photo[]) => {
    const uploadPromises = photos.map(photo => 
      photoService.uploadPhoto(caseId, photo)
    );
    return Promise.all(uploadPromises);
  },
};

// Report Services
export const reportService = {
  submitIncidentReport: async (report: IncidentReport) => {
    const response = await api.post(ENDPOINTS.SUBMIT_REPORT, report);
    return response.data;
  },

  validateReport: async (report: IncidentReport) => {
    const response = await api.post(`${ENDPOINTS.SUBMIT_REPORT}validate/`, report);
    return response.data;
  },

  generatePDF: async (caseId: number) => {
    const response = await api.get(`${ENDPOINTS.CASES}${caseId}/generate-pdf/`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Notification Services
export const notificationService = {
  getNotifications: async (): Promise<Notification[]> => {
    const response = await api.get(ENDPOINTS.NOTIFICATIONS);
    return response.data;
  },

  markAsRead: async (notificationId: number) => {
    const response = await api.patch(`${ENDPOINTS.NOTIFICATIONS}${notificationId}/`, {
      read: true,
    });
    return response.data;
  },
};

export default api;
