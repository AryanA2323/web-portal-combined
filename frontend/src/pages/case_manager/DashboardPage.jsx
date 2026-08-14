import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Typography, Box, CircularProgress } from '@mui/material';
import {
  FolderOpen,
  Schedule,
  CheckCircle,
  Warning,
  AddBox as AddBoxIcon,
  Update as UpdateIcon,
  PersonAdd as PersonAddIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import CaseManagerLayout from './components/CaseManagerLayout';
import StatCard from './components/StatCard';
import api from '../../services/api';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useAuth } from '../../context';
import { NotificationBell } from '../../components/case_manager';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const getUserDisplayName = (u) => {
  if (!u) return 'User';
  if (u.first_name || u.last_name) {
    return `${u.first_name || ''} ${u.last_name || ''}`.trim();
  }
  return u.email || 'User';
};

const CaseManagerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [caseVolume, setCaseVolume] = useState([]);
  const [caseStatus, setCaseStatus] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  const fetchDashboardData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);

      // Fetch all dashboard data in parallel
      const [statsRes, volumeRes, statusRes, activityRes] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: null })),
        api.get('/dashboard/case-volume').catch(() => ({ data: [] })),
        api.get('/dashboard/case-status').catch(() => ({ data: [] })),
        api.get('/dashboard/recent-activity').catch(() => ({ data: [] })),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (volumeRes.data) setCaseVolume(volumeRes.data);
      if (statusRes.data) setCaseStatus(statusRes.data);
      if (activityRes.data) setRecentActivity(activityRes.data);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  };

  useAutoRefresh(fetchDashboardData);

  // Generate stats cards data from API response
  const statsData = stats ? [
    {
      title: 'Total Cases',
      value: stats.total_cases,
      change: stats.total_change,
      icon: FolderOpen,
      iconBgColor: '#e3f2fd',
    },
    {
      title: 'Active Investigations',
      value: stats.active_investigations,
      change: stats.active_change,
      icon: Schedule,
      iconBgColor: '#fff3e0',
    },
    {
      title: 'Completed Cases',
      value: stats.completed_cases,
      change: stats.completed_change,
      icon: CheckCircle,
      iconBgColor: '#e8f5e9',
      onClick: () => navigate('/case_manager/completed-cases'),
    },
    {
      title: 'Pending Cases',
      value: stats.pending_cases || 0,
      change: stats.overdue_change,
      icon: Warning,
      iconBgColor: '#ffebee',
    },
  ] : [];

  // Generate chart data from API response
  const caseVolumeData = {
    labels: caseVolume.map(item => item.month),
    datasets: [
      {
        label: 'Total Cases',
        data: caseVolume.map(item => item.total),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Completed',
        data: caseVolume.map(item => item.completed),
        borderColor: '#48bb78',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const caseStatusData = {
    labels: caseStatus.map(item => item.label),
    datasets: [
      {
        data: caseStatus.map(item => item.count),
        backgroundColor: ['#48bb78', '#f6ad55', '#4299e1', '#9f7aea', '#fc8181', '#718096'],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f0f0f0',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
      },
    },
  };

  if (loading) {
    return (
      <CaseManagerLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </CaseManagerLayout>
    );
  }

  return (
    <CaseManagerLayout disablePadding>
      {/* Welcome Banner Header with User-Provided Background Image */}
      <Box
        sx={{
          minHeight: 120,
          mx: { xs: 1.5, md: 2.5 },
          mb: 3,
          py: { xs: 2.5, md: 3 },
          px: { xs: 3, md: 5 },
          borderRadius: '0 0 16px 16px',
          boxSizing: 'border-box',
          bgcolor: '#ffffff',
          backgroundImage: 'url(/welcome_section_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          boxShadow: '0 4px 16px rgba(148, 163, 184, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderTop: 'none',
        }}
      >
        {/* Left Side: Welcome Text */}
        <Box sx={{ position: 'relative', zIndex: 2 }}>
          <Typography
            sx={{
              fontFamily: '"Caveat", "Dancing Script", "Brush Script MT", "cursive", sans-serif',
              fontSize: { xs: '1.9rem', md: '2.4rem' },
              fontWeight: 500,
              fontStyle: 'normal',
              color: '#4f46e5',
              lineHeight: 1.1,
              mb: 0.2,
            }}
          >
            Welcome back,
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2rem', md: '2.6rem' },
              color: '#0f172a',
              letterSpacing: '-0.8px',
              lineHeight: 1.1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {getUserDisplayName(user)}! <span style={{ display: 'inline-block' }}>👋</span>
          </Typography>
        </Box>

        {/* Right Side: Notification Bell Container (Matching Cases Page) */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            bgcolor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.12)',
            p: 0.5,
            flexShrink: 0,
            transition: 'all 0.25s ease-in-out',
            '&:hover': {
              boxShadow: '0 6px 20px rgba(99, 102, 241, 0.2)',
              transform: 'scale(1.03)',
            },
          }}
        >
          <NotificationBell />
        </Box>
      </Box>

      {/* Main Dashboard Content Padding Container */}
      <Box sx={{ p: { xs: 2, md: 3 }, pt: 0 }}>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, width: '100%' }}>
        {statsData.map((stat, index) => (
          <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
            <StatCard {...stat} />
          </Box>
        ))}
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, width: '100%' }}>
        {/* Case Volume Trend */}
        <Box sx={{ flex: '1 1 50%' }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              height: '400px',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Case Volume Trend
            </Typography>
            <Box sx={{ height: 'calc(100% - 40px)' }}>
              <Line data={caseVolumeData} options={chartOptions} />
            </Box>
          </Paper>
        </Box>

        {/* Case Status Distribution */}
        <Box sx={{ flex: '1 1 50%' }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              height: '400px',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Case Status Distribution
            </Typography>
            <Box sx={{ height: 'calc(100% - 40px)' }}>
              <Pie data={caseStatusData} options={pieChartOptions} />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Bottom Section - Recent Activity (Full Width) */}
      <Box sx={{ width: '100%' }}>
        {/* Recent Activity */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
          }}
        >
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Recent Activity
          </Typography>
          <Box>
            {recentActivity.length > 0 ? recentActivity.map((activity, index) => {
              // Choose icon based on activity type
              let Icon;
              switch (activity.type) {
                case 'new_case':
                  Icon = AddBoxIcon;
                  break;
                case 'status_change':
                  Icon = UpdateIcon;
                  break;
                case 'assigned':
                  Icon = PersonAddIcon;
                  break;
                default:
                  Icon = AccessTimeIcon;
              }
              return (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    gap: 2,
                    mb: 2.5,
                    pb: 2.5,
                    borderBottom: index < recentActivity.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '8px',
                      backgroundColor: '#f0f4ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 18, color: '#667eea' }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '13px',
                        mb: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {activity.text}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999', fontSize: '12px' }}>
                      {activity.time}
                    </Typography>
                  </Box>
                </Box>
              );
            }) : (
              <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', py: 4 }}>
                No recent activity to display.
              </Typography>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  </CaseManagerLayout>
  );
};

export default CaseManagerDashboard;
