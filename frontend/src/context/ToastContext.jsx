import React, { createContext, useContext, useState, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';

// Event emitter for non-React code (like api.js interceptors)
export const toastEmitter = {
  listeners: [],
  emit(message, severity = 'error') {
    this.listeners.forEach((listener) => listener(message, severity));
  },
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  },
};

// Global toast object for easy access
export const toast = {
  success: (msg) => toastEmitter.emit(msg, 'success'),
  error: (msg) => toastEmitter.emit(msg, 'error'),
  info: (msg) => toastEmitter.emit(msg, 'info'),
  warning: (msg) => toastEmitter.emit(msg, 'warning'),
};

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');

  const showToast = (msg, sev = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  };

  useEffect(() => {
    const unsubscribe = toastEmitter.subscribe((msg, sev) => {
      showToast(msg, sev);
    });
    return () => unsubscribe();
  }, []);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        style={{ zIndex: 9999 }}
      >
        <Alert onClose={handleClose} severity={severity} variant="filled" sx={{ width: '100%', boxShadow: 4, fontWeight: 'medium' }}>
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};
