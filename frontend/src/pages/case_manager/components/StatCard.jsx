import { Paper, Typography, Box } from '@mui/material';

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  iconBgColor = '#e3f2fd',
  iconColor = '#667eea'
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        height: '100%',
        width: '100%',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: '#666', fontSize: '13px', mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: '32px' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{
                color: '#999',
                fontSize: '12px',
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            backgroundColor: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ fontSize: 24, color: iconColor }} />
        </Box>
      </Box>
    </Paper>
  );
};

export default StatCard;
