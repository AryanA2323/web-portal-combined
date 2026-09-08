import { Paper, Typography, Box } from '@mui/material';

const ORANGE_TOP_COLOR = '#ea580c';

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
  if (compact) {
    return (
      <Paper
        onClick={onClick}
        elevation={0}
        sx={{
          pt: 1.5,
          pb: 1.25,
          px: 1,
          width: '100%',
          minHeight: { xs: 80, sm: 84, md: 88 },
          height: '100%',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderTop: `3.5px solid ${ORANGE_TOP_COLOR}`,
          bgcolor: '#ffffff',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)',
            borderColor: '#cbd5e1',
            borderTopColor: ORANGE_TOP_COLOR,
            transform: onClick ? 'translateY(-2px)' : 'translateY(-1px)',
          },
          ...customSx,
        }}
      >
        <Box
          sx={{
            width: '100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Top: Large Stat Number (Consistent height so all numbers align horizontally across cards) */}
          <Box sx={{ height: { xs: 28, sm: 30, md: 32 }, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.75 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '22px', sm: '25px', md: '28px' },
                color: '#0f172a',
                lineHeight: 1,
                letterSpacing: '-0.5px',
              }}
            >
              {typeof value === 'number' ? value.toLocaleString() : (value ?? 0)}
            </Typography>
          </Box>

          {/* Bottom: Title Label (Consistent height so all titles align horizontally across cards) */}
          <Box sx={{ minHeight: { xs: 30, md: 34 }, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', px: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                color: '#475569',
                fontWeight: 700,
                fontSize: { xs: '12px', sm: '12.5px', md: '13.5px' },
                lineHeight: 1.25,
                whiteSpace: 'normal',
                wordBreak: 'normal',
                overflowWrap: 'break-word',
                textAlign: 'center',
                letterSpacing: '-0.2px',
              }}
            >
              {title}
            </Typography>
          </Box>
        </Box>

        {subtitle && (
          <Typography
            variant="caption"
            sx={{
              color: '#94a3b8',
              fontSize: '11px',
              fontWeight: 500,
              mt: 0.25,
              textAlign: 'center',
            }}
          >
            {subtitle}
          </Typography>
        )}
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
        borderTop: `3.5px solid ${ORANGE_TOP_COLOR}`,
        borderLeft: '1px solid #f1f5f9',
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
          borderTopColor: ORANGE_TOP_COLOR,
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

      {/* Middle Stat Text Block - Number on top, Title below, perfectly aligned across cards */}
      <Box sx={{ flex: 1, minWidth: 0, zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Large Stat Number on top */}
        <Box sx={{ height: dense ? 30 : 36, display: 'flex', alignItems: 'center' }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: dense ? '26px' : '32px',
              color: '#0f172a',
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
            }}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
        </Box>

        {/* Title Label below */}
        <Typography
          variant="body2"
          sx={{
            color: '#475569',
            fontWeight: 700,
            fontSize: dense ? '14px' : '15.5px',
            lineHeight: 1.25,
            mt: 0.75,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </Typography>

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
          <Icon sx={{ fontSize: dense ? 44 : 56, color: ORANGE_TOP_COLOR }} />
        </Box>
      )}
    </Paper>
  );
};

export default StatCard;
