import { 
  TextField, 
  InputAdornment, 
  IconButton,
  FormHelperText,
  FormControl
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useState } from 'react';

const FormInput = ({
  name,
  label,
  type = 'text',
  placeholder,
  register,
  error,
  icon: Icon,
  disabled = false,
  autoComplete,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <FormControl fullWidth error={!!error} sx={{ mb: { xs: 2.5, sm: 3 } }}>
      <TextField
        {...register(name)}
        label={label}
        type={isPassword && showPassword ? 'text' : type}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        error={!!error}
        variant="outlined"
        fullWidth
        InputProps={{
          startAdornment: Icon && (
            <InputAdornment position="start">
              <Icon className={error ? 'text-red-500' : 'text-gray-400'} />
            </InputAdornment>
          ),
          endAdornment: isPassword && (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleTogglePassword}
                edge="end"
                size="small"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            backgroundColor: '#fafafa',
            transition: 'all 0.2s ease',
            '& input': {
              py: { xs: 1.5, sm: 1.75 },
            },
            '&:hover': {
              backgroundColor: '#f5f5f5',
            },
            '&.Mui-focused': {
              backgroundColor: '#fff',
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '15px',
            fontWeight: 500,
          },
        }}
        {...props}
      />
      {error && (
        <FormHelperText 
          className="animate-fadeIn ml-2 mt-1"
          sx={{ color: '#d32f2f' }}
        >
          {error.message}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default FormInput;
