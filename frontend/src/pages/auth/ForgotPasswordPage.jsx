import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Container,
  Paper,
  Typography,
  Box,
  Link,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Email, LockReset, ArrowBack } from '@mui/icons-material';

import { FormInput, LoadingButton, AlertMessage } from '../../components/common';
import { forgotPasswordSchema } from '../../utils/validationSchemas';
import { authService } from '../../services';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [isLoading, setIsLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, message: '', severity: 'error' });
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setAlertState({ open: false, message: '', severity: 'error' });

    try {
      await authService.forgotPassword(data.email);
      
      setEmailSent(true);
      setAlertState({
        open: true,
        message: 'Password reset code sent to your email!',
        severity: 'success',
      });

      // Navigate to reset password page with email
      setTimeout(() => {
        navigate('/reset-password', { state: { email: data.email } });
      }, 2000);
    } catch (error) {
      let errorMessage = 'Failed to send reset code. Please try again.';
      
      // Map error codes to user-friendly messages
      const errorCode = error.code || '';
      switch (errorCode) {
        case 'INVALID_EMAIL':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'RATE_LIMITED':
          errorMessage = 'Too many requests. Please wait a few minutes before trying again.';
          break;
        default:
          errorMessage = error.error || error.message || errorMessage;
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

  const closeAlert = () => {
    setAlertState({ ...alertState, open: false });
  };

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
          {/* Back Link */}
          <Box className="mb-4">
            <Link
              component={RouterLink}
              to="/login"
              underline="hover"
              className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowBack fontSize="small" />
              Back to Login
            </Link>
          </Box>

          {/* Header */}
          <Box className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl mb-4 shadow-lg">
              <LockReset sx={{ fontSize: 32, color: '#fff' }} />
            </div>
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="h1"
              className="font-bold text-gray-800 mb-2"
            >
              Forgot Password?
            </Typography>
            <Typography variant="body1" className="text-gray-500">
              Enter your email address and we'll send you a verification code to reset your password.
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

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Email Input */}
            <FormInput
              name="email"
              label="Email Address"
              type="email"
              placeholder="Enter your registered email"
              register={register}
              error={errors.email}
              icon={Email}
              disabled={isLoading || emailSent}
              autoComplete="email"
            />

            {/* Submit Button */}
            <LoadingButton
              type="submit"
              loading={isLoading}
              disabled={emailSent}
              className="mt-4"
              sx={{
                background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
                },
              }}
            >
              {emailSent ? 'Code Sent!' : 'Send Reset Code'}
            </LoadingButton>
          </form>

          {/* Info Box */}
          <Box className="mt-6 p-4 bg-blue-50 rounded-lg">
            <Typography variant="body2" className="text-blue-800">
              💡 <strong>Tip:</strong> Check your spam folder if you don't receive the email within a few minutes.
            </Typography>
          </Box>

          {/* Footer */}
          <Box className="mt-6 text-center">
            <Typography variant="body2" className="text-gray-500">
              Remember your password?{' '}
              <Link
                component={RouterLink}
                to="/login"
                underline="hover"
                className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Sign in
              </Link>
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

export default ForgotPasswordPage;
