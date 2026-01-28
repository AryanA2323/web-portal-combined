import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
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
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { Email, Lock, Person, Badge, PersonAdd } from '@mui/icons-material';

import { FormInput, RoleSelector, LoadingButton, AlertMessage } from '../../components/common';
import { signupSchema } from '../../utils/validationSchemas';
import { getRoleDashboard } from '../../utils/constants';
import { authService } from '../../services';
import { useAuth } from '../../context';

const SignupPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, message: '', severity: 'error' });
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Select Role', 'Account Details', 'Complete'];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    trigger,
  } = useForm({
    resolver: yupResolver(signupSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      role: '',
    },
  });

  const selectedRole = watch('role');

  const handleNext = async () => {
    let fieldsToValidate = [];
    
    if (activeStep === 0) {
      fieldsToValidate = ['role'];
    } else if (activeStep === 1) {
      fieldsToValidate = ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName'];
    }
    
    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    setAlertState({ open: false, message: '', severity: 'error' });

    try {
      const response = await authService.register({
        username: data.username,
        email: data.email,
        password: data.password,
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role.toUpperCase(),
      });
      
      setAlertState({
        open: true,
        message: 'Registration successful! Redirecting to dashboard...',
        severity: 'success',
      });

      // Move to complete step
      setActiveStep(2);

      // Redirect based on role after a short delay
      setTimeout(() => {
        const dashboardPath = getRoleDashboard(data.role);
        navigate(dashboardPath);
      }, 2000);
    } catch (error) {
      // Parse error message for user-friendly display
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.error) {
        const errorCode = error.code;
        switch (errorCode) {
          case 'USERNAME_EXISTS':
            errorMessage = 'This username is already taken. Please choose a different username.';
            break;
          case 'EMAIL_EXISTS':
            errorMessage = 'An account with this email already exists. Please use a different email or try logging in.';
            break;
          case 'INVALID_ROLE':
            errorMessage = 'Please select a valid role.';
            break;
          case 'REGISTRATION_FAILED':
            errorMessage = 'Registration failed. Please try again later.';
            break;
          default:
            errorMessage = error.error;
        }
      } else if (error.detail) {
        errorMessage = error.detail;
      } else if (error.message) {
        errorMessage = error.message;
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

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" className="text-center mb-4 text-gray-700">
              What type of account do you need?
            </Typography>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <RoleSelector
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.role}
                  disabled={isLoading}
                />
              )}
            />
            
            {selectedRole && (
              <Box 
                className="mt-4 p-4 rounded-lg animate-fadeIn"
                sx={{ 
                  backgroundColor: selectedRole === 'admin' ? '#fef2f2' : 
                                   selectedRole === 'vendor' ? '#eff6ff' : '#f0fdf4',
                  border: `1px solid ${
                    selectedRole === 'admin' ? '#fecaca' : 
                    selectedRole === 'vendor' ? '#bfdbfe' : '#bbf7d0'
                  }`
                }}
              >
                <Typography variant="body2" className="text-gray-700">
                  {selectedRole === 'admin' && (
                    <>
                      <strong>🔐 Administrator Account</strong>
                      <br />
                      Full access to manage users, incidents, and system settings.
                    </>
                  )}
                  {selectedRole === 'vendor' && (
                    <>
                      <strong>🔧 Vendor Account</strong>
                      <br />
                      Receive and resolve assigned incidents from clients.
                    </>
                  )}
                  {selectedRole === 'client' && (
                    <>
                      <strong>📋 Client Account</strong>
                      <br />
                      Submit incidents and track their resolution status.
                    </>
                  )}
                </Typography>
              </Box>
            )}
          </Box>
        );
      
      case 1:
        return (
          <Box>
            <Box className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <FormInput
                name="firstName"
                label="First Name"
                placeholder="John"
                register={register}
                error={errors.firstName}
                icon={Person}
                disabled={isLoading}
              />
              <FormInput
                name="lastName"
                label="Last Name"
                placeholder="Doe"
                register={register}
                error={errors.lastName}
                icon={Person}
                disabled={isLoading}
              />
            </Box>
            
            <FormInput
              name="username"
              label="Username"
              placeholder="johndoe"
              register={register}
              error={errors.username}
              icon={Badge}
              disabled={isLoading}
              autoComplete="username"
            />
            
            <FormInput
              name="email"
              label="Email Address"
              type="email"
              placeholder="john@example.com"
              register={register}
              error={errors.email}
              icon={Email}
              disabled={isLoading}
              autoComplete="email"
            />
            
            <FormInput
              name="password"
              label="Password"
              type="password"
              placeholder="Min. 8 characters"
              register={register}
              error={errors.password}
              icon={Lock}
              disabled={isLoading}
              autoComplete="new-password"
            />
            
            <FormInput
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              register={register}
              error={errors.confirmPassword}
              icon={Lock}
              disabled={isLoading}
              autoComplete="new-password"
            />
          </Box>
        );
      
      case 2:
        return (
          <Box className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <Typography variant="h5" className="text-gray-800 font-bold mb-2">
              Account Created!
            </Typography>
            <Typography variant="body1" className="text-gray-600 mb-4">
              Welcome to the Incident Management Platform
            </Typography>
            <Typography variant="body2" className="text-gray-500">
              Redirecting you to your dashboard...
            </Typography>
          </Box>
        );
      
      default:
        return null;
    }
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
          {/* Header */}
          <Box className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <PersonAdd sx={{ fontSize: 32, color: '#fff' }} />
            </div>
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              component="h1"
              className="font-bold text-gray-800 mb-2"
            >
              Create Account
            </Typography>
            <Typography variant="body1" className="text-gray-500">
              Join the Incident Management Platform
            </Typography>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={activeStep} alternativeLabel className="mb-6">
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

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
            {renderStepContent(activeStep)}

            {/* Navigation Buttons */}
            {activeStep < 2 && (
              <Box className="flex justify-between mt-6">
                <LoadingButton
                  type="button"
                  variant="outlined"
                  onClick={handleBack}
                  disabled={activeStep === 0 || isLoading}
                  sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}
                >
                  Back
                </LoadingButton>
                
                {activeStep === 1 ? (
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
                    Create Account
                  </LoadingButton>
                ) : (
                  <LoadingButton
                    type="button"
                    onClick={handleNext}
                    disabled={!selectedRole}
                    sx={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      },
                    }}
                  >
                    Next
                  </LoadingButton>
                )}
              </Box>
            )}
          </form>

          {/* Footer */}
          {activeStep < 2 && (
            <Box className="mt-6 text-center">
              <Typography variant="body2" className="text-gray-500">
                Already have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/login"
                  underline="hover"
                  className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Sign in
                </Link>
              </Typography>
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

export default SignupPage;
