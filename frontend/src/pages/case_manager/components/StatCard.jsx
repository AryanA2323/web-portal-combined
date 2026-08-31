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
  const getThemeColor = () => {
    if (accentColor) return accentColor;
    if (iconColor && iconColor !== '#2563eb') return iconColor;
    if (iconBgColor === '#e3f2fd') return '#1d4ed8'; // Blue (Total Cases / Reports)
    if (iconBgColor === '#ede7f6') return '#7e22ce'; // Purple (Generated Reports)
    if (iconBgColor === '#fff3e0') return '#c2410c'; // Amber/Orange (WIP / Assigned Business Partners)
    if (iconBgColor === '#e8f5e9') return '#15803d'; // Green (Closed / Dispatch Cases)
    if (iconBgColor === '#ffebee') return '#dc2626'; // Red (Overdue / Rejected)
    return iconColor || '#1d4ed8';
  };

  const themeColor = getThemeColor();

  if (compact) {
    return (
      <Paper
        onClick={onClick}
        elevation={0}
        sx={{
          py: 1.25,
          px: 1,
          width: '100%',
          minHeight: { xs: 78, sm: 84, md: 88 },
          height: '100%',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderTop: `3.5px solid ${themeColor}`,
          bgcolor: '#ffffff',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)',
            borderColor: '#cbd5e1',
            borderTopColor: themeColor,
            transform: onClick ? 'translateY(-2px)' : 'translateY(-1px)',
          },
          ...customSx,
        }}
      >
        <Box sx={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              mb: 0.5,
              fontSize: { xs: '22px', sm: '25px', md: '28px' },
              color: themeColor,
              lineHeight: 1,
              letterSpacing: '-0.5px',
            }}
          >
            {typeof value === 'number' ? value.toLocaleString() : (value ?? 0)}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: '#334155',
              fontWeight: 600,
              fontSize: { xs: '11px', sm: '11.5px', md: '12px' },
              lineHeight: 1.25,
              whiteSpace: 'normal',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
              textAlign: 'center',
              letterSpacing: '-0.2px',
              maxWidth: '100%',
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
            fontWeight: 500,
            fontSize: dense ? '28px' : '32px',
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
            fontWeight: 600,
            fontSize: dense ? '13px' : '14px',
            lineHeight: 1.25,
            mt: 0.5,
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
