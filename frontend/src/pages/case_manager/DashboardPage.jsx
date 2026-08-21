import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  FolderOpen as FolderOpenIcon,
  HourglassEmpty as NotInitiatedIcon,
  Autorenew as WIPIcon,
  CheckCircleOutline as CheckCircleIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import api from '../../services/api';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useAuth } from '../../context';
import { NotificationBell } from '../../components/case_manager';

const getUserDisplayName = (u) => {
  if (!u) return 'Case Manager';
  if (u.first_name || u.last_name) {
    return `${u.first_name || ''} ${u.last_name || ''}`.trim();
  }
  return u.email || 'Case Manager';
};

const getFormattedToday = () => {
  const now = new Date();
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const formatted = now.toLocaleDateString('en-GB', options);
  return `Today, ${formatted}`;
};

// Sparkline trend curve component with end marker dot
const MiniSparkline = ({ color = '#2563eb', pathD = 'M0 24 C 20 28, 35 14, 55 20 C 75 26, 85 8, 100 12', dotY = 12 }) => (
  <Box sx={{ width: 110, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
    <svg width="110" height="38" viewBox="0 0 110 38" fill="none" style={{ overflow: 'visible' }}>
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="104" cy={dotY} r="3.5" fill={color} />
    </svg>
  </Box>
);

const CaseManagerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  const fetchDashboardData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);

      const statsRes = await api.get('/dashboard/stats').catch(() => ({ data: null }));
      if (statsRes?.data) setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  };

  useAutoRefresh(fetchDashboardData);

  const statsCardsConfig = [
    {
      id: 'total',
      title: 'Total Cases',
      value: stats?.total_cases ?? 0,
      subtext: 'All time cases',
      icon: FolderOpenIcon,
      iconColor: '#2563eb',
      iconBg: '#eff6ff',
      sparklineColor: '#2563eb',
      sparklinePath: 'M0 26 C 24 32, 38 16, 58 22 C 78 28, 90 10, 104 14',
      dotY: 14,
      onClick: () => navigate('/case_manager/cases'),
    },
    {
      id: 'not_initiated',
      title: 'Not Initiated Cases',
      value: stats?.not_initiated_cases ?? 0,
      subtext: 'Awaiting action',
      icon: NotInitiatedIcon,
      iconColor: '#7c3aed',
      iconBg: '#f5f3ff',
      sparklineColor: '#8b5cf6',
      sparklinePath: 'M0 24 C 22 28, 40 18, 62 26 C 80 12, 94 22, 104 10',
      dotY: 10,
      onClick: () => navigate('/case_manager/cases?status=NI'),
    },
    {
      id: 'wip',
      title: 'WIP Cases',
      value: stats?.wip_cases ?? stats?.active_investigations ?? 0,
      subtext: 'Work in progress',
      icon: WIPIcon,
      iconColor: '#ea580c',
      iconBg: '#fff7ed',
      sparklineColor: '#f59e0b',
      sparklinePath: 'M0 28 C 20 20, 38 32, 56 18 C 74 26, 90 8, 104 12',
      dotY: 12,
      onClick: () => navigate('/case_manager/cases?status=WIP'),
    },
    {
      id: 'closed',
      title: 'Closed Cases',
      value: stats?.closed_cases ?? 0,
      subtext: 'Successfully closed',
      icon: CheckCircleIcon,
      iconColor: '#16a34a',
      iconBg: '#f0fdf4',
      sparklineColor: '#10b981',
      sparklinePath: 'M0 26 C 26 28, 44 24, 64 16 C 80 10, 92 18, 104 8',
      dotY: 8,
      onClick: () => navigate('/case_manager/closed-cases'),
    },
  ];

  if (loading) {
    return (
      <CaseManagerLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress size={44} thickness={4} sx={{ color: '#2563eb' }} />
        </Box>
      </CaseManagerLayout>
    );
  }

  return (
    <CaseManagerLayout disablePadding>
      {/* Full-width container using 100% width with reduced top spacing */}
      <Box sx={{ width: '100%', px: { xs: 2, sm: 3, md: 3.5, lg: 4 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 3, md: 4 }, boxSizing: 'border-box' }}>

        {/* ========================================================================= */}
        {/* 1. TOP HERO BANNER: Full-Width, Minimal & Elegant with 3D Graphic         */}
        {/* ========================================================================= */}
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            position: 'relative',
            borderRadius: '20px',
            bgcolor: '#ffffff',
            border: '1px solid rgba(226, 232, 240, 0.85)',
            boxShadow: '0 4px 24px rgba(99, 102, 241, 0.05)',
            overflow: 'hidden',
            p: { xs: 3, sm: 4, md: 4.5, lg: 5 },
            mb: { xs: 3, md: 3.5 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: { xs: 'auto', md: 230 },
            boxSizing: 'border-box',
          }}
        >
          {/* Top-Right Notification Icon */}
          <Box
            sx={{
              position: 'absolute',
              top: { xs: 16, md: 22 },
              right: { xs: 16, md: 24 },
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#ffffff',
              border: '1px solid rgba(226, 232, 240, 0.95)',
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
              p: '4px',
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                borderColor: '#c7d2fe',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.15)',
                transform: 'scale(1.05)',
              },
            }}
          >
            <NotificationBell />
          </Box>

          {/* Subtle Background Flowing Wave Lines SVG */}
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: { xs: '100%', md: '70%' },
              pointerEvents: 'none',
              overflow: 'hidden',
              zIndex: 0,
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 700 240"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ opacity: 0.85 }}
            >
              <path
                d="M0,195 C180,110 330,230 490,120 C580,65 640,100 700,80"
                stroke="#6366f1"
                strokeWidth="1.2"
                strokeOpacity="0.16"
                fill="none"
              />
              <path
                d="M0,170 C160,85 340,210 500,100 C590,45 650,80 700,60"
                stroke="#3b82f6"
                strokeWidth="1.2"
                strokeOpacity="0.14"
                fill="none"
              />
              <path
                d="M0,215 C200,140 320,250 480,140 C560,85 620,120 700,100"
                stroke="#818cf8"
                strokeWidth="1"
                strokeOpacity="0.12"
                fill="none"
              />
              <path
                d="M40,235 C210,130 360,240 520,130 C600,75 660,110 700,90"
                stroke="#93c5fd"
                strokeWidth="1"
                strokeOpacity="0.18"
                fill="none"
              />
            </svg>
          </Box>

          {/* Decorative Dot Matrix Pattern on Lower Right */}
          <Box
            sx={{
              position: 'absolute',
              right: { xs: 16, md: 44 },
              bottom: { xs: 16, md: 32 },
              display: { xs: 'none', sm: 'grid' },
              gridTemplateColumns: 'repeat(3, 8px)',
              gap: '10px',
              opacity: 0.35,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {[...Array(6)].map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  bgcolor: '#6366f1',
                }}
              />
            ))}
          </Box>

          {/* Left Text & Action Controls */}
          <Box sx={{ position: 'relative', zIndex: 1, maxWidth: { xs: '100%', md: '58%', lg: '62%' } }}>
            {/* Header Greeting with Wave Emoji */}
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.75rem', sm: '2.1rem', md: '2.45rem' },
                color: '#0f172a',
                letterSpacing: '-0.6px',
                lineHeight: 1.2,
                mb: 1.2,
              }}
            >
              Welcome back, {getUserDisplayName(user)}!
            </Typography>

            {/* Subtitles / Taglines */}
            <Typography
              sx={{
                fontSize: { xs: '14px', sm: '15.5px' },
                fontWeight: 500,
                color: '#475569',
                lineHeight: 1.4,
                mb: 0.3,
              }}
            >
              Smart insights. Better decisions.
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '13px', sm: '14px' },
                fontWeight: 400,
                color: '#64748b',
                lineHeight: 1.4,
                mb: { xs: 2.5, md: 3.5 },
              }}
            >
              Track and manage your cases efficiently.
            </Typography>

            {/* Action Buttons Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, flexWrap: 'wrap' }}>
              {/* Primary View All Cases Button */}
              <Button
                variant="contained"
                onClick={() => navigate('/case_manager/cases')}
                startIcon={<FolderOpenIcon sx={{ fontSize: '19px !important' }} />}
                sx={{
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  textTransform: 'none',
                  borderRadius: '10px',
                  px: 2.75,
                  py: 1.15,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    bgcolor: '#1d4ed8',
                    boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                View All Cases
              </Button>

              {/* Date Filter/Display Pill */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2.2,
                  py: 1.1,
                  bgcolor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                  color: '#334155',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'default',
                  userSelect: 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: '#cbd5e1',
                    bgcolor: '#f8fafc',
                  },
                }}
              >
                <CalendarIcon sx={{ fontSize: 17, color: '#64748b' }} />
                <span>{getFormattedToday()}</span>
              </Box>
            </Box>
          </Box>

          {/* Right Side: Professional High-End 3D Graphic with Ambient Glow & Concentric Rings */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              mr: { md: 5, lg: 9 },
            }}
          >
            {/* Ambient Radial Halo */}
            <Box
              sx={{
                position: 'absolute',
                width: 210,
                height: 210,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(199, 210, 254, 0.5) 0%, rgba(224, 231, 255, 0.2) 60%, transparent 100%)',
                filter: 'blur(16px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            {/* Outer Glowing Concentric Ring */}
            <Box
              sx={{
                width: { md: 156, lg: 172 },
                height: { md: 156, lg: 172 },
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(239, 246, 255, 0.95) 0%, rgba(224, 231, 255, 0.5) 65%, rgba(255, 255, 255, 0) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 36px rgba(99, 102, 241, 0.12)',
                border: '1.5px solid rgba(219, 234, 254, 0.85)',
                position: 'relative',
                zIndex: 1,
                transition: 'all 0.35s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.03)',
                  boxShadow: '0 16px 44px rgba(37, 99, 235, 0.18)',
                },
              }}
            >
              {/* Inner Glossy Circular Badge Container */}
              <Box
                sx={{
                  width: { md: 114, lg: 128 },
                  height: { md: 114, lg: 128 },
                  borderRadius: '50%',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 2px 6px rgba(255, 255, 255, 0.9), 0 8px 26px rgba(37, 99, 235, 0.16)',
                  border: '1px solid rgba(255, 255, 255, 0.95)',
                  overflow: 'hidden',
                  p: 1,
                }}
              >
                <Box
                  component="img"
                  src="/dashboard_scales_3d.jpg"
                  alt="Case Management & Legal Analytics"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 8px rgba(37, 99, 235, 0.15))',
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ========================================================================= */}
        {/* 2. STATS CARDS ROW: Full-Width 4 Clean & Elegant KPI Cards with Sparklines */}
        {/* ========================================================================= */}
        <Box
          sx={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: { xs: 2, md: 2.5, lg: 3 },
          }}
        >
          {statsCardsConfig.map((card) => {
            const IconComponent = card.icon;
            return (
              <Paper
                key={card.id}
                elevation={0}
                onClick={card.onClick}
                sx={{
                  width: '100%',
                  boxSizing: 'border-box',
                  bgcolor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid rgba(226, 232, 240, 0.85)',
                  boxShadow: '0 3px 16px rgba(0, 0, 0, 0.025)',
                  p: { xs: 2.5, md: 3 },
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 148,
                  cursor: card.onClick ? 'pointer' : 'default',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    boxShadow: '0 10px 28px rgba(99, 102, 241, 0.09)',
                    borderColor: 'rgba(203, 213, 225, 0.9)',
                    transform: 'translateY(-3px)',
                  },
                }}
              >
                {/* Top Section: Icon and Title */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75, mb: 1.5 }}>
                  {/* Left Icon Pill */}
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      bgcolor: card.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconComponent sx={{ fontSize: 23, color: card.iconColor }} />
                  </Box>

                  {/* Title & Large Number */}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      sx={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#64748b',
                        lineHeight: 1.2,
                        mb: 0.4,
                      }}
                    >
                      {card.title}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: '#0f172a',
                        letterSpacing: '-0.5px',
                        lineHeight: 1.1,
                      }}
                    >
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </Typography>
                  </Box>
                </Box>

                {/* Bottom Section: Subtitle & Mini Sparkline Curve */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    pt: 1,
                    borderTop: '1px solid #f8fafc',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '12px',
                      fontWeight: 400,
                      color: '#94a3b8',
                      lineHeight: 1.2,
                    }}
                  >
                    {card.subtext}
                  </Typography>

                  <MiniSparkline
                    color={card.sparklineColor}
                    pathD={card.sparklinePath}
                    dotY={card.dotY}
                  />
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>
    </CaseManagerLayout>
  );
};

export default CaseManagerDashboard;
