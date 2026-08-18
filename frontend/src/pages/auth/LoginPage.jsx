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
import { Email, Lock } from '@mui/icons-material';

import { FormInput, LoadingButton } from '../../components/common';
import { loginSchema } from '../../utils/validationSchemas';
import { getRoleDashboard } from '../../utils/constants';
import { useAuth } from '../../context';
import { toast } from '../../context/ToastContext';
import companyLogo from '../../SS_logo.jpg';

const LoginPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);

    try {
      const response = await login(data.email, data.password);

      // Check if 2FA is required
      if (response.requires2FA) {
        toast.info('A verification code has been sent to your email.');

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

      toast.success('Login successful! Redirecting...');

      // Get user's role from response and redirect
      const userRole = response.role?.toLowerCase() || response.user?.role?.toLowerCase();
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

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
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
          {/* Header Logo */}
          <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                maxWidth: 240,
                height: 60,
                mx: 'auto',
                mb: 2.5,
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                boxShadow: '0 10px 25px rgba(102, 126, 234, 0.12)',
                overflow: 'hidden', // Ensure the image stays within the rounded corners
                px: 2, // Add some padding so the logo doesn't touch the edges
              }}
            >
              <Box
                component="img"
                src={companyLogo}
                alt="Shoveltech Solutions"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: 'scale(1.1)',
                }}
              />
            </Box>
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="h1"
              sx={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                color: '#1a1a1a',
                mb: 1.5,
                letterSpacing: '-0.5px',
              }}
            >
              Welcome
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

          {/* Alert Message Removed (Using Global Toast) */}

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
            © 2026 Shovel Screening Solutions.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
