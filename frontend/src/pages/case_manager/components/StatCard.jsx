import { Paper, Typography, Box } from '@mui/material';

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = '#e3f2fd',
  iconColor = '#667eea',
  onClick,
  compact = false,
  hideIcon = false,
}) => {
  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: compact ? 0.75 : 3,
        width: compact ? { xs: '100%', md: 94 } : '100%',
        height: compact ? { xs: '100%', md: 82 } : '100%',
        borderRadius: '12px',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        bgcolor: '#ffffff',
        boxShadow: '0 2px 10px rgba(99, 102, 241, 0.06)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 6px 18px rgba(99, 102, 241, 0.14)',
          borderColor: '#c7d2fe',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', width: '100%', height: '100%' }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Number Above */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              mb: compact ? 0.65 : 0.5,
              fontSize: compact ? '22px' : '32px',
              color: '#0f172a',
              lineHeight: 1.05,
              letterSpacing: '-0.5px',
            }}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>

          {/* Title Below */}
          <Typography
            variant="body2"
            sx={{
              color: '#64748b',
              fontWeight: 600,
              fontSize: compact ? '11px' : '14px',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              letterSpacing: '-0.2px',
            }}
          >
            {title}
          </Typography>

          {subtitle && (
            <Typography
              variant="caption"
              sx={{
                color: '#94a3b8',
                fontSize: '11px',
                fontWeight: 500,
                mt: 0.2,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {Icon && !hideIcon && (
          <Box
            sx={{
              width: compact ? 40 : 48,
              height: compact ? 40 : 48,
              borderRadius: '12px',
              backgroundColor: iconBgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              ml: 1,
            }}
          >
            <Icon sx={{ fontSize: compact ? 20 : 24, color: iconColor }} />
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default StatCard;
