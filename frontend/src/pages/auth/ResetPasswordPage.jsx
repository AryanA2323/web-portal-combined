import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
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
  TextField,
  Button,
} from '@mui/material';
import { Lock, CheckCircle, ArrowBack, Refresh } from '@mui/icons-material';

import { FormInput, LoadingButton, AlertMessage } from '../../components/common';
import { verifyResetCodeSchema, resetPasswordSchema } from '../../utils/validationSchemas';
import { authService } from '../../services';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [step, setStep] = useState(1); // 1: Enter code, 2: Set new password, 3: Success
  const [isLoading, setIsLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, message: '', severity: 'error' });
  const [email, setEmail] = useState(location.state?.email || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check for token in URL (for link-based reset)
  const urlParams = new URLSearchParams(location.search);
  const resetToken = urlParams.get('token');

  useEffect(() => {
    if (resetToken) {
      setStep(2); // Skip to password reset if token exists
    }
  }, [resetToken]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Code verification form
  const {
    register: registerCode,
    handleSubmit: handleSubmitCode,
    formState: { errors: codeErrors },
  } = useForm({
    resolver: yupResolver(verifyResetCodeSchema),
  });

  // Password reset form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
  } = useForm({
    resolver: yupResolver(resetPasswordSchema),
  });

  const handleVerifyCode = async (data) => {
    setIsLoading(true);
    setAlertState({ open: false, message: '', severity: 'error' });

    try {
      await authService.verifyResetCode(email, data.code);
      setVerificationCode(data.code);
      setStep(2);
      setAlertState({
        open: true,
        message: 'Code verified! Now set your new password.',
        severity: 'success',
      });
    } catch (error) {
      let errorMessage = 'Invalid or expired code. Please try again.';
      
      // Map error codes to user-friendly messages
      const errorCode = error.code || '';
      switch (errorCode) {
        case 'INVALID_CODE':
          errorMessage = 'Invalid or expired verification code. Please request a new code.';
          break;
        case 'CODE_EXPIRED':
          errorMessage = 'Verification code has expired. Please request a new code.';
          break;
        case 'TOO_MANY_ATTEMPTS':
          errorMessage = 'Too many failed attempts. Please request a new code.';
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

  const handleResetPassword = async (data) => {
    setIsLoading(true);
    setAlertState({ open: false, message: '', severity: 'error' });

    try {
      if (resetToken) {
        // Token-based reset (from link)
        await authService.resetPasswordWithToken(resetToken, data.newPassword, data.confirmPassword);
      } else {
        // Code-based reset
        await authService.resetPassword(email, verificationCode, data.newPassword, data.confirmPassword);
      }
      
      setStep(3);
      setAlertState({
        open: true,
        message: 'Password reset successful!',
        severity: 'success',
      });
    } catch (error) {
      let errorMessage = 'Failed to reset password. Please try again.';
      
      // Map error codes to user-friendly messages
      const errorCode = error.code || '';
      switch (errorCode) {
        case 'PASSWORD_MISMATCH':
          errorMessage = 'Passwords do not match. Please ensure both passwords are the same.';
          break;
        case 'INVALID_CODE':
          errorMessage = 'Invalid or expired verification code. Please request a new reset code.';
          break;
        case 'INVALID_TOKEN':
          errorMessage = 'Invalid or expired reset link. Please request a new password reset.';
          break;
        case 'EXPIRED_TOKEN':
          errorMessage = 'This reset link has expired. Please request a new password reset.';
          break;
        case 'INVALID_REQUEST':
          errorMessage = 'Invalid request. Please try again or request a new reset code.';
          break;
        case 'WEAK_PASSWORD':
          errorMessage = 'Password is too weak. Please use at least 8 characters with uppercase, lowercase, and numbers.';
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

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !email) return;
    
    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      setResendCooldown(60);
      setAlertState({
        open: true,
        message: 'New code sent to your email!',
        severity: 'success',
      });
    } catch (error) {
      setAlertState({
        open: true,
        message: 'Failed to resend code.',
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
          {step !== 3 && (
            <Box className="mb-4">
              <Link
                component={RouterLink}
                to={step === 1 ? '/forgot-password' : '#'}
                onClick={step === 2 && !resetToken ? () => setStep(1) : undefined}
                underline="hover"
                className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
              >
                <ArrowBack fontSize="small" />
                {step === 1 ? 'Back' : 'Change Code'}
              </Link>
            </Box>
          )}

          {/* Step 1: Enter Verification Code */}
          {step === 1 && (
            <>
              <Box className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
                  <Lock sx={{ fontSize: 32, color: '#fff' }} />
                </div>
                <Typography variant={isMobile ? 'h5' : 'h4'} className="font-bold text-gray-800 mb-2">
                  Enter Verification Code
                </Typography>
                <Typography variant="body1" className="text-gray-500">
                  We've sent a 6-digit code to <strong>{email}</strong>
                </Typography>
              </Box>

              <Divider className="my-6" />

              <AlertMessage
                open={alertState.open}
                severity={alertState.severity}
                message={alertState.message}
                onClose={closeAlert}
              />

              {/* Email field if not provided */}
              {!email && (
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mb-4"
                  sx={{ mb: 2 }}
                />
              )}

              <form onSubmit={handleSubmitCode(handleVerifyCode)} noValidate>
                <TextField
                  {...registerCode('code')}
                  fullWidth
                  label="Verification Code"
                  placeholder="Enter 6-digit code"
                  error={!!codeErrors.code}
                  helperText={codeErrors.code?.message}
                  disabled={isLoading}
                  inputProps={{ maxLength: 6, style: { letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.5rem' } }}
                  sx={{ mb: 3 }}
                />

                <LoadingButton type="submit" loading={isLoading}>
                  Verify Code
                </LoadingButton>
              </form>

              {/* Resend Code */}
              <Box className="mt-4 text-center">
                <Button
                  variant="text"
                  startIcon={<Refresh />}
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isLoading}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </Button>
              </Box>
            </>
          )}

          {/* Step 2: Set New Password */}
          {step === 2 && (
            <>
              <Box className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl mb-4 shadow-lg">
                  <Lock sx={{ fontSize: 32, color: '#fff' }} />
                </div>
                <Typography variant={isMobile ? 'h5' : 'h4'} className="font-bold text-gray-800 mb-2">
                  Set New Password
                </Typography>
                <Typography variant="body1" className="text-gray-500">
                  Create a strong password for your account
                </Typography>
              </Box>

              <Divider className="my-6" />

              <AlertMessage
                open={alertState.open}
                severity={alertState.severity}
                message={alertState.message}
                onClose={closeAlert}
              />

              <form onSubmit={handleSubmitPassword(handleResetPassword)} noValidate>
                <FormInput
                  name="newPassword"
                  label="New Password"
                  type="password"
                  placeholder="Enter new password"
                  register={registerPassword}
                  error={passwordErrors.newPassword}
                  icon={Lock}
                  disabled={isLoading}
                />

                <FormInput
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  placeholder="Confirm new password"
                  register={registerPassword}
                  error={passwordErrors.confirmPassword}
                  icon={Lock}
                  disabled={isLoading}
                />

                <LoadingButton
                  type="submit"
                  loading={isLoading}
                  className="mt-2"
                  sx={{
                    background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                    },
                  }}
                >
                  Reset Password
                </LoadingButton>
              </form>

              {/* Password Requirements */}
              <Box className="mt-4 p-3 bg-gray-50 rounded-lg">
                <Typography variant="caption" className="text-gray-600">
                  Password must contain:
                  <ul className="mt-1 ml-4 list-disc">
                    <li>At least 8 characters</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                  </ul>
                </Typography>
              </Box>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <Box className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckCircle sx={{ fontSize: 48, color: '#10b981' }} />
              </div>
              <Typography variant="h5" className="font-bold text-gray-800 mb-2">
                Password Reset Successful!
              </Typography>
              <Typography variant="body1" className="text-gray-500 mb-6">
                Your password has been changed. You can now sign in with your new password.
              </Typography>
              <LoadingButton
                onClick={() => navigate('/login')}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                Go to Login
              </LoadingButton>
            </Box>
          )}
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

export default ResetPasswordPage;
