import React from 'react';
import { Dialog, DialogContent, DialogTitle, IconButton, Typography, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocationPicker from './LocationPicker';

/**
 * LocationPickerModal Component
 * Full-featured popup modal for picking locations on map and returning coordinates + address.
 */
const LocationPickerModal = ({
  open,
  onClose,
  onLocationSelect,
  title = 'Pin Point Map Location',
  subtitle = 'Drag map or search to pick the exact spot',
  initialCenter = [12.9716, 77.5946],
  initialZoom = 15,
}) => {
  const handleSelect = (data) => {
    onLocationSelect(data);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
        },
      }}
    >
      <DialogTitle
        sx={{
          p: 2,
          px: 2.5,
          bgcolor: '#17539C',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            sx={{
              p: 0.8,
              bgcolor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <LocationOnIcon sx={{ color: '#F36F21', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight="700" lineHeight={1.2}>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {subtitle}
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={onClose}
          sx={{
            color: '#ffffff',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' },
          }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, height: '560px', position: 'relative' }}>
        {open && (
          <LocationPicker
            initialCenter={initialCenter}
            initialZoom={initialZoom}
            height="100%"
            onLocationSelect={handleSelect}
            onCancel={onClose}
            confirmButtonText="Confirm & Save Location"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LocationPickerModal;
