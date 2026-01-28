import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { VendorUser, AuthResponse } from '@/types';
import apiService from '@/services/api';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@/config/constants';

interface AuthState {
  user: VendorUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.login(email, password);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { rejectWithValue }) => {
  try {
    await apiService.logout();
  } catch (error: any) {
    return rejectWithValue(error.message || 'Logout failed');
  }
});

export const restoreToken = createAsyncThunk('auth/restoreToken', async (_, { rejectWithValue }) => {
  try {
    const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    const userDataJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
    
    if (accessToken && userDataJson) {
      return {
        accessToken,
        refreshToken,
        user: JSON.parse(userDataJson),
      };
    }
    
    return rejectWithValue('No stored credentials');
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to restore token');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.access;
        state.refreshToken = action.payload.refresh;
        state.error = null;
        // Store user data
        SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(action.payload.user));
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload as string;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
        SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
      })
      .addCase(logoutUser.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      })
      .addCase(restoreToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(
        restoreToken.fulfilled,
        (
          state,
          action: PayloadAction<{
            accessToken: string;
            refreshToken: string | null;
            user: VendorUser;
          }>
        ) => {
          state.isLoading = false;
          state.isAuthenticated = true;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          state.user = action.payload.user;
          state.error = null;
        }
      )
      .addCase(restoreToken.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
