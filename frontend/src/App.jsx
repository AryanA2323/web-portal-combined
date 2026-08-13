import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { AuthProvider } from './context';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage, TwoFactorPage } from './pages';
import { 
  CaseManagerDashboard,
  SuperAdminDashboard,
  CasesPage,
  NewCasePage, 
  UsersPage, 
  AIBriefPage, 
  LegalReviewPage, 
  ReportsPage as CaseManagerReportsPage, 
  AuditLogsPage, 
  SettingsPage,
  CheckDetailPage,
  ClientsPage,
  CompletedCasesPage,
  ApprovalsPage,
} from './pages/case_manager';
import {
  DashboardPage as QCDashboardPage,
  ReportsPage as QCReportsPage,
  LogsPage as QCLogsPage,
} from './pages/qc';

// Create MUI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff4081',
      dark: '#c51162',
    },
    success: {
      main: '#2e7d32',
    },
    warning: {
      main: '#ed6c02',
    },
    error: {
      main: '#d32f2f',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", system-ui, -apple-system, sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <AuthProvider>
          <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/register" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-2fa" element={<TwoFactorPage />} />
            
            {/* Protected Routes - QC */}
            <Route
              path="/qc/dashboard"
              element={
                <ProtectedRoute allowedRoles={['qc']}>
                  <QCDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/qc/reports"
              element={
                <ProtectedRoute allowedRoles={['qc']}>
                  <QCReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/qc/logs"
              element={
                <ProtectedRoute allowedRoles={['qc']}>
                  <QCLogsPage />
                </ProtectedRoute>
              }
            />
            
            {/* Protected Routes - Super Admin */}
            <Route
              path="/super-admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/approvals"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <ApprovalsPage />
                </ProtectedRoute>
              }
            />
            
            {/* Protected Routes - CaseManager */}
            <Route
              path="/case_manager/dashboard"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <CaseManagerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/cases"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <CasesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/cases/new"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <NewCasePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/completed-cases"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <CompletedCasesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/users"
              element={
                <ProtectedRoute allowedRoles={['case_manager', 'super_admin']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/clients"
              element={
                <ProtectedRoute allowedRoles={['case_manager', 'super_admin']}>
                  <ClientsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/ai-brief"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <AIBriefPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/legal-review"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <LegalReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/reports"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <CaseManagerReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case_manager/settings"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/case_manager/cases/:caseId/check/:checkType"
              element={
                <ProtectedRoute allowedRoles={['case_manager']}>
                  <CheckDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
