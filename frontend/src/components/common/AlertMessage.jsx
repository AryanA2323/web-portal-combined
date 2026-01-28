import { Alert, Collapse, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';

const AlertMessage = ({
  open = true,
  severity = 'error',
  message,
  onClose,
  className = '',
}) => {
  if (!message) return null;

  return (
    <Collapse in={open}>
      <Alert
        severity={severity}
        className={`mb-4 rounded-lg animate-fadeIn ${className}`}
        action={
          onClose && (
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={onClose}
            >
              <Close fontSize="inherit" />
            </IconButton>
          )
        }
        sx={{
          '& .MuiAlert-icon': {
            alignItems: 'center',
          },
          '& .MuiAlert-message': {
            padding: '4px 0',
          },
        }}
      >
        {message}
      </Alert>
    </Collapse>
  );
};

export default AlertMessage;
