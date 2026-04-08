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
          if (token && token.length > 0) {
            config.headers.Authorization = `Bearer ${token}`;
            // Debug log for troubleshooting (only log token length, not the actual token)
            console.log(`[API] Request to ${config.url}, token attached (length: ${token.length})`);
          } else {
            console.log(`[API] Request to ${config.url}, no token available`);
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

        // Don't try to refresh token for logout endpoint or if already retried
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/logout')) {
          originalRequest._retry = true;

          if (this.isRefreshing) {
            return new Promise((onSuccess, onFailed) => {
              this.failedQueue.push({ onSuccess, onFailed });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return this.api(originalRequest);
              })
              .catch(() => Promise.reject(error));
          }

          this.isRefreshing = true;

          try {
            const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
            if (!refreshToken) {
              // No refresh token available, silently clear tokens and reject
              await Promise.all([
                SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN).catch(() => {}),
                SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN).catch(() => {}),
                SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA).catch(() => {})
              ]);
              this.isRefreshing = false;
              this.processQueue(error, null);
              return Promise.reject(error);
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
            await Promise.all([
              SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN).catch(() => {}),
              SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN).catch(() => {}),
              SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA).catch(() => {})
            ]);
            return Promise.reject(error);
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

      // Check if 2FA is required (202 response)
      if (response.status === 202 || response.data.requires_2fa) {
        throw {
          message: response.data.message || 'Two-factor authentication required',
          status: 202,
        };
      }

      // Extract the token from the response
      const { token, user } = response.data;
      const accessToken = token?.token || token;

      // Validate token before storing
      if (!accessToken || typeof accessToken !== 'string' || accessToken.length < 10) {
        console.error('Invalid token received:', accessToken);
        throw {
          message: 'Invalid authentication token received',
          status: 401,
        };
      }

      // Store the access token (refresh token not available from this endpoint)
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      console.log('Token stored successfully, length:', accessToken.length);

      // Transform backend user data to match VendorUser interface
      const vendorUser = {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim() || user.username,
        phone: user.phone || '',
        company: user.company || '',
        role: user.role,
      };

      // Return formatted response matching AuthResponse type
      return {
        user: vendorUser,
        access: accessToken,
        refresh: null,
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async logout(): Promise<void> {
    try {
      // Try to call logout endpoint, but don't fail if it errors
      await this.api.post('/auth/logout');
    } catch (error) {
      // Silently ignore logout endpoint errors - we'll clear tokens anyway
    } finally {
      // Always clear tokens regardless of API call result
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN).catch(() => {}),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN).catch(() => {}),
        SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA).catch(() => {})
      ]);
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

  // Vendor assigned checks (sub-check level)
  async getVendorAssignedChecks(): Promise<any> {
    try {
      const response = await this.api.get('/vendor-assigned-checks');
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async getVendorCheckDetail(caseId: number, checkType: string): Promise<any> {
    try {
      const response = await this.api.get(`/vendor-check-detail/${caseId}/${checkType}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async uploadCheckEvidence(
    caseId: number,
    checkType: string,
    photos: Array<{ uri: string; name: string }>
  ): Promise<any> {
    try {
      const formData = new FormData();
      for (const photo of photos) {
        const fileType = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
        const file: any = {
          uri: photo.uri,
          name: photo.name,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
        };
        formData.append('photos', file);
      }
      const response = await this.api.post(
        `/vendor-check-upload/${caseId}/${checkType}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async deleteCheckEvidence(caseId: number, checkType: string, filename: string): Promise<any> {
    try {
      const response = await this.api.delete(`/vendor-check-evidence/${caseId}/${checkType}`, {
        params: { filename },
      });
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
      const response = await this.api.get('/vendors/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async uploadEvidence(
    caseId: number, 
    photos: Array<{ uri: string; name: string; lat?: string; long?: string }>
  ): Promise<any> {
    try {
      const formData = new FormData();
      
      // Add each photo to form data with GPS validation
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const fileUri = photo.uri;
        const fileName = photo.name;
        const fileType = fileName.split('.').pop()?.toLowerCase() || 'jpg';
        
        // Create file object for upload
        const file: any = {
          uri: fileUri,
          name: fileName,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
        };
        
        formData.append('photos', file);
      }
      
      const response = await this.api.post(`/cases/${caseId}/upload-evidence`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for file upload
      });
      
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async getEvidencePhotos(caseId: number): Promise<any> {
    try {
      const response = await this.api.get(`/cases/${caseId}/evidence-photos`);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async deleteEvidencePhoto(photoId: number): Promise<any> {
    try {
      const response = await this.api.delete(`/evidence-photos/${photoId}`);
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

  // ==========================================================================
  // Statement Audio Endpoints - Marathi Speech-to-Text with English Translation
  // ==========================================================================

  /**
   * Preview audio transcription without applying to statement.
   * Processes the audio, returns Marathi transcript and English translation.
   */
  async previewStatementAudio(
    caseId: number,
    checkType: string,
    audioFile: { uri: string; name: string; mimeType: string }
  ): Promise<{
    success: boolean;
    audit_id: number;
    transcript_mr: string;
    translation_en: string;
    detected_language: string;
    confidence: number | null;
    provider: string;
    audio_duration_seconds: number | null;
    next_statement_index: number;
    statement_count: number;
    max_statements_per_check: number;
  }> {
    try {
      const formData = new FormData();
      const file: any = {
        uri: audioFile.uri,
        name: audioFile.name,
        type: audioFile.mimeType,
      };
      formData.append('audio', file);

      const response = await this.api.post(
        `/vendor-check-statement-audio-preview/${caseId}/${checkType}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000, // 2 minutes for audio processing
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Apply audio transcription to case statement.
   * Processes audio, translates, and saves to the statement field.
   */
  async applyStatementAudio(
    caseId: number,
    checkType: string,
    audioFile: { uri: string; name: string; mimeType: string }
  ): Promise<{
    success: boolean;
    audit_id: number;
    transcript_mr: string;
    translation_en: string;
    applied_to_column: string;
    detected_language: string;
    confidence: number | null;
    provider: string;
    audio_duration_seconds: number | null;
    statement_index: number;
    statement_count: number;
    max_statements_per_check: number;
  }> {
    try {
      const formData = new FormData();
      const file: any = {
        uri: audioFile.uri,
        name: audioFile.name,
        type: audioFile.mimeType,
      };
      formData.append('audio', file);

      const response = await this.api.post(
        `/vendor-check-statement-audio-apply/${caseId}/${checkType}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000, // 2 minutes for audio processing
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Apply manually edited statement text.
   * Allows vendor to modify the translation before saving.
   */
  async applyStatementText(
    caseId: number,
    checkType: string,
    editedEnglishText: string,
    transcriptMr?: string
  ): Promise<{
    success: boolean;
    audit_id: number;
    applied_text: string;
    applied_to_column: string;
    statement_index: number;
    statement_count: number;
    max_statements_per_check: number;
  }> {
    try {
      const response = await this.api.post(
        `/vendor-check-statement-text-apply/${caseId}/${checkType}`,
        {
          edited_english_text: editedEnglishText,
          transcript_mr: transcriptMr || '',
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }
}

export default new ApiService();
