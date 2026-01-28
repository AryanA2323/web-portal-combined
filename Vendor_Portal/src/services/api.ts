import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_TIMEOUT, STORAGE_KEYS } from '@/config/constants';
import { ApiError, AuthResponse } from '@/types';

class ApiService {
  private api: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    onSuccess: (token: string) => void;
    onFailed: (error: AxiosError) => void;
  }> = [];

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error retrieving token:', error);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((onSuccess, onFailed) => {
              this.failedQueue.push({ onSuccess, onFailed });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return this.api(originalRequest);
              });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await axios.post(
              `${API_BASE_URL}/auth/refresh/`,
              { refresh: refreshToken },
              { timeout: API_TIMEOUT }
            );

            const { access } = response.data;
            await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access);

            this.api.defaults.headers.common.Authorization = `Bearer ${access}`;
            originalRequest.headers.Authorization = `Bearer ${access}`;

            this.processQueue(null, access);
            return this.api(originalRequest);
          } catch (refreshError) {
            this.processQueue(refreshError as AxiosError, null);
            // Clear stored tokens on refresh failure
            await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
            await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: AxiosError | null, token: string | null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.onFailed(error);
      } else if (token) {
        prom.onSuccess(token);
      }
    });
    this.failedQueue = [];
  }

  private handleError(error: AxiosError): ApiError {
    const apiError: ApiError = {
      message: error.message,
      status: error.response?.status || 0,
    };

    if (error.response?.data) {
      apiError.details = error.response.data;
    }

    return apiError;
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.api.post<any>('/auth/login', {
        username: email,
        password,
      });
      
      // Extract the token from the response
      const { token, user } = response.data;
      const accessToken = token?.token || token;
      
      // Store the access token (refresh token not available from this endpoint)
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      
      // Return formatted response matching AuthResponse type
      return {
        user,
        access: accessToken,
        refresh: null,
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    }
  }

  // Vendor endpoints
  async getVendorCases(vendorId?: number): Promise<any> {
    try {
      // Get cases for authenticated vendor (vendorId is optional now)
      const response = await this.api.get('/vendor-cases');
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async getCases(): Promise<any> {
    try {
      // This is for admin/super admin only
      const response = await this.api.get('/cases/');
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async getCaseDetail(caseId: number): Promise<any> {
    try {
      const response = await this.api.get(`/cases/${caseId}/`);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async getVendorProfile(): Promise<any> {
    try {
      const response = await this.api.get('/vendors/profile/');
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  // Utility methods
  async setTokens(accessToken: string, refreshToken: string | null): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
  }

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  }

  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  }
}

export default new ApiService();
