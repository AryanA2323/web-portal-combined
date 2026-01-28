import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Case, CasesResponse } from '@/types';
import apiService from '@/services/api';

interface CasesState {
  cases: Case[];
  selectedCase: Case | null;
  isLoading: boolean;
  error: string | null;
  totalCount: number;
}

const initialState: CasesState = {
  cases: [],
  selectedCase: null,
  isLoading: false,
  error: null,
  totalCount: 0,
};

export const fetchCases = createAsyncThunk(
  'cases/fetchCases',
  async (_arg: undefined, { rejectWithValue }) => {
    try {
      // Always fetch vendor cases for authenticated vendor
      const response = await apiService.getVendorCases();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch cases');
    }
  }
);

export const fetchCaseDetail = createAsyncThunk(
  'cases/fetchCaseDetail',
  async (caseId: number, { rejectWithValue }) => {
    try {
      const response = await apiService.getCaseDetail(caseId);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch case details');
    }
  }
);

const casesSlice = createSlice({
  name: 'cases',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedCase: (state) => {
      state.selectedCase = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCases.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCases.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        // Handle both array and paginated responses
        if (Array.isArray(action.payload)) {
          state.cases = action.payload;
          state.totalCount = action.payload.length;
        } else if (action.payload.cases) {
          // Handle vendor cases response format
          state.cases = action.payload.cases;
          state.totalCount = action.payload.total || action.payload.cases.length;
        } else if (action.payload.results) {
          state.cases = action.payload.results;
          state.totalCount = action.payload.count || action.payload.results.length;
        } else {
          state.cases = [];
          state.totalCount = 0;
        }
        state.error = null;
      })
      .addCase(fetchCases.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.cases = [];
      })
      .addCase(fetchCaseDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCaseDetail.fulfilled, (state, action: PayloadAction<Case>) => {
        state.isLoading = false;
        state.selectedCase = action.payload;
        state.error = null;
      })
      .addCase(fetchCaseDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.selectedCase = null;
      });
  },
});

export const { clearError, clearSelectedCase } = casesSlice.actions;
export default casesSlice.reducer;
