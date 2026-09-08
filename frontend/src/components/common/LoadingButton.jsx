import { Button, CircularProgress } from '@mui/material';

const LoadingButton = ({
  children,
  loading = false,
  disabled = false,
  variant = 'contained',
  color = 'primary',
  fullWidth = true,
  size = 'large',
  startIcon,
  type = 'button',
  onClick,
  className = '',
  sx = {},
  ...props
}) => {
  return (
    <Button
      type={type}
      variant={variant}
      color={color}
      fullWidth={fullWidth}
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      startIcon={loading ? null : startIcon}
      className={`relative ${className}`}
      sx={{
        borderRadius: '10px',
        py: { xs: 1.5, sm: 1.75 },
        px: 3,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: { xs: '15px', sm: '16px' },
        background: variant === 'contained' 
          ? '#17539C'
          : 'transparent',
        backgroundColor: variant === 'contained' 
          ? '#17539C'
          : 'transparent',
        boxShadow: variant === 'contained' 
          ? '0 4px 14px 0 rgba(23, 83, 156, 0.4)'
          : 'none',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: disabled || loading ? 'none' : 'translateY(-1px)',
          background: variant === 'contained'
            ? '#F36F21'
            : 'transparent',
          backgroundColor: variant === 'contained'
            ? '#F36F21'
            : 'transparent',
          boxShadow: variant === 'contained'
            ? '0 6px 20px 0 rgba(243, 111, 33, 0.45)'
            : 'none',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
        '&.Mui-disabled': {
          backgroundColor: variant === 'contained' ? '#e0e0e0' : 'transparent',
          background: variant === 'contained' ? '#e0e0e0' : 'transparent',
          color: '#9e9e9e',
        },
        ...sx,
      }}
      {...props}
    >
      {loading ? (
        <>
          <CircularProgress
            size={24}
            className="absolute"
            sx={{ color: variant === 'contained' ? '#fff' : 'primary.main' }}
          />
          <span className="opacity-0">{children}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
};

export default LoadingButton;
