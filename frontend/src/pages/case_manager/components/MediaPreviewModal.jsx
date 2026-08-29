import React from 'react';
import { Dialog, Box, IconButton, Button, Typography } from '@mui/material';
import { Close, Download, InsertDriveFile } from '@mui/icons-material';

const MediaPreviewModal = ({ open, onClose, media }) => {
  if (!media) return null;

  const isPdf = media.url?.toLowerCase().endsWith('.pdf');
  const isImage = media.type === 'photo' || media.url?.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <Box sx={{ position: 'relative', bgcolor: isImage ? '#0f172a' : '#f8fafc', p: 1, display: 'flex', flexDirection: 'column', minHeight: 300, height: isPdf ? '90vh' : 'auto' }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: isImage ? '#fff' : '#475569',
            bgcolor: isImage ? 'rgba(0,0,0,0.5)' : '#e2e8f0',
            '&:hover': { bgcolor: isImage ? 'rgba(0,0,0,0.8)' : '#cbd5e1' },
            zIndex: 10
          }}
        >
          <Close />
        </IconButton>

        {isImage && (
          <Box
            component="img"
            src={media.url}
            alt={media.title || 'Media Preview'}
            sx={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '4px', margin: 'auto' }}
          />
        )}

        {isPdf && !isImage && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 6, px: 2, pb: 2 }}>
            <iframe
              src={media.url}
              title={media.title || 'Document Preview'}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
            />
          </Box>
        )}

        {!isImage && !isPdf && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
            <InsertDriveFile sx={{ fontSize: 64, color: '#94a3b8' }} />
            <Typography variant="h6" sx={{ color: '#334155', fontWeight: 600 }}>
              {media.title || 'Document'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
              This file type cannot be previewed inline.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => window.open(media.url, '_blank')}
              sx={{ textTransform: 'none', borderRadius: '8px', px: 4 }}
            >
              Download / View Externally
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default MediaPreviewModal;
