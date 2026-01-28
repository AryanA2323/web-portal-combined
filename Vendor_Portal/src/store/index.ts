import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import casesReducer from './casesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cases: casesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
