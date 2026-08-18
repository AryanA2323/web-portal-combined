import { Paper, Typography, Box } from '@mui/material';

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = '#eff6ff',
  iconColor = '#2563eb',
  accentColor,
  onClick,
  compact = false,
  hideIcon = false,
  dense = false,
  sx: customSx = {},
}) => {
  const themeColor = accentColor || iconColor || '#2563eb';

  if (compact) {
    return (
      <Paper
        onClick={onClick}
        elevation={0}
        sx={{
          p: 0.75,
          width: { xs: '100%', md: 94 },
          height: { xs: '100%', md: 82 },
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
          ...customSx,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              mb: 0.65,
              fontSize: '22px',
              color: themeColor,
              lineHeight: 1.05,
              letterSpacing: '-0.5px',
            }}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: '#64748b',
              fontWeight: 600,
              fontSize: '11px',
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
      </Paper>
    );
  }

  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: dense ? 1.75 : 2.25,
        px: dense ? 2 : 2.5,
        width: '100%',
        height: '100%',
        minHeight: dense ? '82px' : '100px',
        borderRadius: dense ? '14px' : '16px',
        borderLeft: `4px solid ${themeColor}`,
        borderTop: '1px solid #f1f5f9',
        borderRight: '1px solid #f1f5f9',
        borderBottom: '1px solid #f1f5f9',
        bgcolor: '#ffffff',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s ease-in-out',
        '&:hover': {
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
          transform: 'translateY(-2px)',
        },
        ...customSx,
      }}
    >
      {/* Left Avatar Icon */}
      {Icon && !hideIcon && (
        <Box
          sx={{
            width: dense ? 46 : 52,
            height: dense ? 46 : 52,
            borderRadius: '50%',
            backgroundColor: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mr: dense ? 1.75 : 2,
            boxShadow: `0 4px 12px ${iconBgColor}`,
          }}
        >
          <Icon sx={{ fontSize: dense ? 24 : 26, color: iconColor }} />
        </Box>
      )}

      {/* Middle Stat Text Block */}
      <Box sx={{ flex: 1, minWidth: 0, zIndex: 1 }}>
        {/* Large Stat Number */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            fontSize: dense ? '24px' : '28px',
            color: themeColor,
            lineHeight: 1.1,
            letterSpacing: '-0.5px',
          }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>

        {/* Title Label */}
        <Typography
          variant="body2"
          sx={{
            color: '#1e293b',
            fontWeight: 700,
            fontSize: dense ? '12.5px' : '13.5px',
            lineHeight: 1.25,
            mt: 0.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </Typography>

        {/* Subtitle */}
        {subtitle && (
          <Typography
            variant="caption"
            sx={{
              color: '#94a3b8',
              fontSize: dense ? '11px' : '12px',
              fontWeight: 500,
              display: 'block',
              mt: 0.25,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* Faint Background Watermark Icon on Far Right */}
      {Icon && !hideIcon && (
        <Box
          sx={{
            position: 'absolute',
            right: dense ? 12 : 16,
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: 0.12,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ fontSize: dense ? 44 : 56, color: themeColor }} />
        </Box>
      )}
    </Paper>
  );
};

export default StatCard;
