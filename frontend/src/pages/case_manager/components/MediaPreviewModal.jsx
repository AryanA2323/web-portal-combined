import React from 'react';
import { Dialog, Box, IconButton, Button, Typography } from '@mui/material';
import { Close, Download, InsertDriveFile, OpenInNew } from '@mui/icons-material';

const MediaPreviewModal = ({ open, onClose, media }) => {
  if (!media) return null;

  const isPdf = media.url?.toLowerCase().split('?')[0].endsWith('.pdf') || (media.title && media.title.toLowerCase().endsWith('.pdf'));
  const isImage = media.type === 'photo' || media.url?.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={isPdf ? "sm" : "lg"} fullWidth>
      <Box sx={{ position: 'relative', bgcolor: isImage ? '#0f172a' : '#f8fafc', p: 1, display: 'flex', flexDirection: 'column', minHeight: 300 }}>
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
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 5, gap: 2 }}>
            <InsertDriveFile sx={{ fontSize: 64, color: '#0284c7' }} />
            <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 700, textAlign: 'center', wordBreak: 'break-all' }}>
              {media.title || 'PDF Document'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', maxWidth: 380 }}>
              Click below to view the full PDF in a new browser tab.
            </Typography>
            <Button
              variant="contained"
              startIcon={<OpenInNew />}
              onClick={() => window.open(media.url, '_blank', 'noopener,noreferrer')}
              sx={{ textTransform: 'none', borderRadius: '8px', px: 3.5, py: 1, bgcolor: '#17539C', fontWeight: 600, mt: 1, '&:hover': { bgcolor: '#0f3a70' } }}
            >
              Open PDF in New Tab
            </Button>
          </Box>
        )}

        {!isImage && !isPdf && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2, p: 5 }}>
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
              onClick={() => window.open(media.url, '_blank', 'noopener,noreferrer')}
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
