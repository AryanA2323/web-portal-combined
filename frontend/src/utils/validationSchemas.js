import * as yup from 'yup';

// Login validation schema
export const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

// 2FA verification schema
export const twoFactorSchema = yup.object().shape({
  code: yup
    .string()
    .matches(/^\d{6}$/, 'Code must be exactly 6 digits')
    .required('Verification code is required'),
});

// Forgot password schema
export const forgotPasswordSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
});

// Verify reset code schema
export const verifyResetCodeSchema = yup.object().shape({
  code: yup
    .string()
    .matches(/^\d{6}$/, 'Code must be exactly 6 digits')
    .required('Verification code is required'),
});

// Reset password schema
export const resetPasswordSchema = yup.object().shape({
  newPassword: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('New password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword'), null], 'Passwords must match')
    .required('Please confirm your password'),
});

// Registration validation schema (for future use)
export const registerSchema = yup.object().shape({
  firstName: yup
    .string()
    .max(150, 'First name cannot exceed 150 characters'),
  lastName: yup
    .string()
    .max(150, 'Last name cannot exceed 150 characters'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
  role: yup
    .string()
    .oneOf(['lawyer', 'admin'], 'Please select a valid role')
    .required('Please select your role'),
});

// Signup validation schema (multi-step form)
export const signupSchema = yup.object().shape({
  username: yup
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(150, 'Username cannot exceed 150 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .required('Username is required'),
  firstName: yup
    .string()
    .max(150, 'First name cannot exceed 150 characters'),
  lastName: yup
    .string()
    .max(150, 'Last name cannot exceed 150 characters'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
  role: yup
    .string()
    .oneOf(['lawyer', 'admin'], 'Please select a valid role')
    .required('Please select your role'),
});
