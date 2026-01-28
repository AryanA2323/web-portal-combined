import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Container,
  Paper,
  Typography,
  Box,
  Divider,
  useMediaQuery,
  useTheme,
  TextField,
  Button,
} from '@mui/material';
import { Security, Refresh, CheckCircle } from '@mui/icons-material';

import { LoadingButton, AlertMessage } from '../../components/common';
import { twoFactorSchema } from '../../utils/validationSchemas';
import { authService } from '../../services';
import { useAuth } from '../../context';
import { getRoleDashboard } from '../../utils/constants';

const TwoFactorPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { complete2FALogin } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, message: '', severity: 'error' });
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Get credentials from navigation state
  const { email, password } = location.state || {};

  // Redirect if no credentials
  useEffect(() => {
    if (!email || !password) {
      navigate('/login');
    }
  }, [email, password, navigate]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: yupResolver(twoFactorSchema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setAlertState({ open: false, message: '', severity: 'error' });

    try {
      // Complete 2FA login and update auth context
      const response = await complete2FALogin(email, password, data.code);
      
      setAlertState({
        open: true,
        message: 'Login successful! Redirecting...',
        severity: 'success',
      });

      // Get user's role from response and redirect to appropriate dashboard
      const userRole = response.user?.role?.toLowerCase();
      const dashboardPath = getRoleDashboard(userRole);

      setTimeout(() => {
        navigate(dashboardPath);
      }, 1000);
    } catch (error) {
      let errorMessage = 'Invalid verification code. Please try again.';
      
      // Map error codes to user-friendly messages
      const errorCode = error.code || '';
      switch (errorCode) {
        case 'INVALID_2FA_CODE':
          errorMessage = 'Invalid or expired verification code. Please enter the correct code or request a new one.';
          break;
        case 'INVALID_CREDENTIALS':
          errorMessage = 'Session expired. Please go back and login again.';
          break;
        case 'ACCOUNT_DISABLED':
          errorMessage = 'Your account has been disabled. Please contact support.';
          break;
        case 'CODE_EXPIRED':
          errorMessage = 'Verification code has expired. Please request a new code.';
          break;
        default:
          errorMessage = error.error || errorMessage;
      }
      
      setAlertState({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
      reset();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    try {
      await authService.resend2FACode(email, password);
      setResendCooldown(60);
      setAlertState({
        open: true,
        message: 'New verification code sent to your email!',
        severity: 'success',
      });
    } catch (error) {
      let errorMessage = 'Failed to resend code. Please try again.';
      
      const errorCode = error.code || '';
      switch (errorCode) {
        case 'INVALID_CREDENTIALS':
          errorMessage = 'Session expired. Please go back and login again.';
          break;
        case '2FA_NOT_ENABLED':
          errorMessage = '2FA is not enabled for your account.';
          break;
        case 'RATE_LIMITED':
          errorMessage = 'Too many requests. Please wait before requesting another code.';
          break;
        default:
          errorMessage = error.error || errorMessage;
      }
      
      setAlertState({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const closeAlert = () => {
    setAlertState({ ...alertState, open: false });
  };

  if (!email || !password) {
    return null;
  }

  return (
    <div className="min-h-screen w-full gradient-bg flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      <Container maxWidth="sm" className="relative z-10">
        <Paper
          elevation={24}
          className="glass-effect rounded-2xl overflow-hidden animate-fadeIn"
          sx={{ p: isMobile ? 3 : 5 }}
        >
          {/* Header */}
          <Box className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <Security sx={{ fontSize: 32, color: '#fff' }} />
            </div>
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="h1"
              className="font-bold text-gray-800 mb-2"
            >
              Two-Factor Authentication
            </Typography>
            <Typography variant="body1" className="text-gray-500">
              Enter the 6-digit code sent to your email
            </Typography>
            <Typography variant="body2" className="text-gray-400 mt-1">
              {email}
            </Typography>
          </Box>

          <Divider className="my-6" />

          {/* Alert Message */}
          <AlertMessage
            open={alertState.open}
            severity={alertState.severity}
            message={alertState.message}
            onClose={closeAlert}
          />

          {/* 2FA Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              {...register('code')}
              fullWidth
              label="Verification Code"
              placeholder="000000"
              error={!!errors.code}
              helperText={errors.code?.message}
              disabled={isLoading}
              inputProps={{ 
                maxLength: 6, 
                style: { 
                  letterSpacing: '0.75em', 
                  textAlign: 'center', 
                  fontSize: '1.75rem',
                  fontWeight: 600,
                  padding: '16px',
                } 
              }}
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                },
              }}
            />

            <LoadingButton
              type="submit"
              loading={isLoading}
              sx={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                },
              }}
            >
              Verify & Sign In
            </LoadingButton>
          </form>

          {/* Resend & Back buttons */}
          <Box className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="text"
              startIcon={<Refresh />}
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || isLoading}
              className="text-gray-600"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </Button>
            <Button
              variant="text"
              onClick={handleBackToLogin}
              disabled={isLoading}
              className="text-gray-600"
            >
              Back to Login
            </Button>
          </Box>

          {/* Info Box */}
          <Box className="mt-6 p-4 bg-indigo-50 rounded-lg">
            <Typography variant="body2" className="text-indigo-800">
              🔐 <strong>Secure Login:</strong> Two-factor authentication adds an extra layer of security to your account.
            </Typography>
          </Box>
        </Paper>

        {/* Footer branding */}
        <Typography 
          variant="caption" 
          className="block text-center mt-6 text-white/70"
        >
          © 2026 Incident Management Platform. All rights reserved.
        </Typography>
      </Container>
    </div>
  );
};

export default TwoFactorPage;
