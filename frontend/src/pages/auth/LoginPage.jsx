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
import { Email, Lock, Security } from '@mui/icons-material';

import { FormInput, LoadingButton, AlertMessage } from '../../components/common';
import { loginSchema } from '../../utils/validationSchemas';
import { getRoleDashboard } from '../../utils/constants';
import { useAuth } from '../../context';

const LoginPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, message: '', severity: 'error' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setAlertState({ open: false, message: '', severity: 'error' });

    try {
      const response = await login(data.email, data.password);
      
      // Check if 2FA is required
      if (response.requires2FA) {
        setAlertState({
          open: true,
          message: 'A verification code has been sent to your email.',
          severity: 'info',
        });
        
        // Redirect to 2FA verification page with credentials
        setTimeout(() => {
          navigate('/verify-2fa', { 
            state: { 
              email: data.email, 
              password: data.password,
            } 
          });
        }, 1500);
        return;
      }
      
      setAlertState({
        open: true,
        message: 'Login successful! Redirecting...',
        severity: 'success',
      });

      // Get user's role from response and redirect
      const userRole = response.user?.role?.toLowerCase();
      const dashboardPath = getRoleDashboard(userRole);
      
      // Navigate after a short delay to ensure state is updated
      setTimeout(() => {
        navigate(dashboardPath, { replace: true });
      }, 1500);
    } catch (error) {
      // Parse error message for user-friendly display
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.error) {
        // Map backend error codes to user-friendly messages
        const errorCode = error.code;
        switch (errorCode) {
          case 'INVALID_CREDENTIALS':
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            break;
          case 'ACCOUNT_DISABLED':
            errorMessage = 'Your account has been disabled. Please contact support.';
            break;
          default:
            errorMessage = error.error;
        }
      } else if (error.detail) {
        errorMessage = error.detail;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.non_field_errors?.[0]) {
        errorMessage = error.non_field_errors[0];
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
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      {/* Animated Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: { xs: '300px', md: '500px' },
            height: { xs: '300px', md: '500px' },
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 20s ease-in-out infinite',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '-20%',
            left: '-10%',
            width: { xs: '250px', md: '400px' },
            height: { xs: '250px', md: '400px' },
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 15s ease-in-out infinite reverse',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '200px', md: '350px' },
            height: { xs: '200px', md: '350px' },
            background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'pulse 10s ease-in-out infinite',
          }}
        />
      </Box>

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 10 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3.5, sm: 5, md: 6 },
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 100px rgba(255,255,255,0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            animation: 'slideUp 0.6s ease-out',
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: { xs: 4, sm: 5 } }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 70,
                height: 70,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '20px',
                mb: 3,
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                animation: 'iconBounce 0.8s ease-out',
              }}
            >
              <Security sx={{ fontSize: 40, color: '#fff' }} />
            </Box>
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="h1"
              sx={{
                fontWeight: 700,
                color: '#1a1a1a',
                mb: 1.5,
                letterSpacing: '-0.5px',
              }}
            >
              Welcome Back
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#666',
                fontSize: { xs: '14px', sm: '15px' },
                fontWeight: 400,
              }}
            >
              Sign in to continue to your dashboard
            </Typography>
          </Box>

          {/* Alert Message */}
          <Box sx={{ mb: alertState.open ? 3 : 0 }}>
            <AlertMessage
              open={alertState.open}
              severity={alertState.severity}
              message={alertState.message}
              onClose={closeAlert}
            />
          </Box>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Email Input */}
            <FormInput
              name="email"
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              register={register}
              error={errors.email}
              icon={Email}
              disabled={isLoading}
              autoComplete="email"
            />

            {/* Password Input */}
            <FormInput
              name="password"
              label="Password"
              type="password"
              placeholder="Enter your password"
              register={register}
              error={errors.password}
              icon={Lock}
              disabled={isLoading}
              autoComplete="current-password"
            />

            {/* Forgot Password Link */}
            <Box sx={{ textAlign: 'right', mb: { xs: 3, sm: 3.5 }, mt: -1 }}>
              <Link
                component={RouterLink}
                to="/forgot-password"
                underline="hover"
                sx={{
                  fontSize: '14px',
                  color: '#667eea',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  '&:hover': {
                    color: '#764ba2',
                  },
                }}
              >
                Forgot password?
              </Link>
            </Box>

            {/* Submit Button */}
            <LoadingButton
              type="submit"
              loading={isLoading}
              sx={{ mt: 0 }}
            >
              Sign In
            </LoadingButton>
          </form>

          {/* Divider */}
          <Divider sx={{ my: { xs: 3.5, sm: 4 } }}>
            <Typography variant="caption" sx={{ color: '#999', px: 2, fontSize: '12px' }}>
              SECURE LOGIN
            </Typography>
          </Divider>

          {/* Footer branding */}
          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              color: '#666',
              fontSize: '13px',
              fontWeight: 400,
            }}
          >
            © 2026 Shovel Screen. All rights reserved.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
