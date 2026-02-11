import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { AuthProvider } from './context';
import { ProtectedRoute } from './components';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage, TwoFactorPage } from './pages';
import { LawyerDashboard } from './pages/dashboards';
import { 
  AdminDashboard,
  SuperAdminDashboard,
  CasesPage, 
  EmailIntakePage,
  DocumentProcessPage,
  UsersPage, 
  AIBriefPage, 
  LegalReviewPage, 
  ReportsPage as AdminReportsPage, 
  AuditLogsPage, 
  SettingsPage 
} from './pages/admin';
import {
  DashboardPage as LawyerDashboardPage,
  ReportsPage as LawyerReportsPage,
  LogsPage as LawyerLogsPage,
} from './pages/lawyer';

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
            
            {/* Protected Routes - Lawyer */}
            <Route
              path="/lawyer/dashboard"
              element={
                <ProtectedRoute allowedRoles={['lawyer']}>
                  <LawyerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lawyer/reports"
              element={
                <ProtectedRoute allowedRoles={['lawyer']}>
                  <LawyerReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lawyer/logs"
              element={
                <ProtectedRoute allowedRoles={['lawyer']}>
                  <LawyerLogsPage />
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
            
            {/* Protected Routes - Admin */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cases"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CasesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/email-intake"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <EmailIntakePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/process-document"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DocumentProcessPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ai-brief"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AIBriefPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/legal-review"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <LegalReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            
            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
