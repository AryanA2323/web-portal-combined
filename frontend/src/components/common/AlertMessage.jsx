import { useEffect, useRef } from 'react';
import { toast } from '../../context/ToastContext';

const AlertMessage = ({
  open = true,
  severity = 'error',
  message,
  onClose,
  className = '',
}) => {
  const prevOpen = useRef(false);

  useEffect(() => {
    // Only trigger if it transitioned to open, and we have a message
    if (open && message && !prevOpen.current) {
      if (severity === 'error') {
        toast.error(message);
      } else if (severity === 'success') {
        toast.success(message);
      } else if (severity === 'warning') {
        toast.warning(message);
      } else {
        toast.info(message);
      }
      
      // Auto-close the parent state so it can be re-triggered
      if (onClose) {
        setTimeout(onClose, 100);
      }
    }
    prevOpen.current = open;
  }, [open, message, severity, onClose]);

  return null; // Do not render inline anymore
};

export default AlertMessage;
