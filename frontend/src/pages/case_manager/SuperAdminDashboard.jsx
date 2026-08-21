import { useState, useEffect } from 'react';
import { getRoleStyle } from '../../utils/constants';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Avatar,
  Grid,
  Select,
  MenuItem,
  FormControl,
  Button,
} from '@mui/material';
import {
  People,
  PersonAdd,
  Store,
  Business,
  History,
  CheckCircle,
  Cancel,
  HourglassEmpty,
} from '@mui/icons-material';
import { Pie } from 'react-chartjs-2';
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
import { useNavigate } from 'react-router-dom';
import CaseManagerLayout from './components/CaseManagerLayout';
import StatCard from './components/StatCard';
import superAdminService from '../../services/superAdminService';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import AlertMessage from '../../components/common/AlertMessage';
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

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCmId, setSelectedCmId] = useState('');

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  const fetchDashboardData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const data = await superAdminService.getSuperAdminDashboard();
      setDashboardData(data);
      if (data?.case_managers && data.case_managers.length > 0) {
        setSelectedCmId((prev) => (prev && prev !== 'ALL' ? prev : data.case_managers[0].id));
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useAutoRefresh(fetchDashboardData);

  if (loading) {
    return (
      <CaseManagerLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </CaseManagerLayout>
    );
  }

  if (error) {
    return (
      <CaseManagerLayout>
        <Box p={3}>
          <AlertMessage severity="error" message={error} open={!!error} />
        </Box>
      </CaseManagerLayout>
    );
  }

  const {
    user_statistics,
    vendor_statistics,
    system_statistics,
    recent_users,
    case_managers = [],
    activity_logs = [],
    deletion_logs = [],
  } = dashboardData || {};

  // Prepare stats cards data
  const statsData = [
    {
      title: 'Total Users',
      value: user_statistics?.total_users || 0,
      subtitle: `${user_statistics?.active_users || 0} active`,
      icon: People,
      iconBgColor: '#dbeafe',
      iconColor: '#1d4ed8',
      accentColor: '#2563eb',
      onClick: () => navigate('/case_manager/users', { state: { role: 'ALL', time: 'ALL' } }),
      sx: {
        bgcolor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderLeft: '5px solid #2563eb',
        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.12)',
        '&:hover': {
          boxShadow: '0 8px 22px rgba(37, 99, 235, 0.22)',
          transform: 'translateY(-2px)',
          borderColor: '#93c5fd',
        },
      },
    },
    {
      title: 'New Users (30 days)',
      value: user_statistics?.new_users_last_30_days || 0,
      subtitle: `${user_statistics?.new_users_last_7_days || 0} this week`,
      icon: PersonAdd,
      iconBgColor: '#dcfce7',
      iconColor: '#15803d',
      accentColor: '#16a34a',
      onClick: () => navigate('/case_manager/users', { state: { time: '30' } }),
      sx: {
        bgcolor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderLeft: '5px solid #16a34a',
        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.12)',
        '&:hover': {
          boxShadow: '0 8px 22px rgba(22, 163, 74, 0.22)',
          transform: 'translateY(-2px)',
          borderColor: '#86efac',
        },
      },
    },
    {
      title: 'Total Business Partners',
      value: vendor_statistics?.total_vendors || 0,
      subtitle: `${vendor_statistics?.active_vendors || 0} active`,
      icon: Store,
      iconBgColor: '#ffedd5',
      iconColor: '#c2410c',
      accentColor: '#ea580c',
      onClick: () => navigate('/case_manager/users', { state: { role: 'VENDOR' } }),
      sx: {
        bgcolor: '#fff7ed',
        border: '1px solid #fed7aa',
        borderLeft: '5px solid #ea580c',
        boxShadow: '0 4px 14px rgba(234, 88, 12, 0.12)',
        '&:hover': {
          boxShadow: '0 8px 22px rgba(234, 88, 12, 0.22)',
          transform: 'translateY(-2px)',
          borderColor: '#fdba74',
        },
      },
    },
    {
      title: 'Total Clients',
      value: user_statistics?.total_clients || user_statistics?.users_by_role?.CLIENT || 0,
      subtitle: `${user_statistics?.active_clients || 0} active`,
      icon: Business,
      iconBgColor: '#f3e8ff',
      iconColor: '#7e22ce',
      accentColor: '#9333ea',
      onClick: () => navigate('/case_manager/clients'),
      sx: {
        bgcolor: '#faf5ff',
        border: '1px solid #e9d5ff',
        borderLeft: '5px solid #9333ea',
        boxShadow: '0 4px 14px rgba(147, 51, 234, 0.12)',
        '&:hover': {
          boxShadow: '0 8px 22px rgba(147, 51, 234, 0.22)',
          transform: 'translateY(-2px)',
          borderColor: '#d8b4fe',
        },
      },
    },
  ];

  const getRoleLabel = (role) => {
    const labels = {
      SUPER_ADMIN: 'Super Admin',
      CASE_MANAGER: 'Case Manager',
      VENDOR: 'Business Partner',
      CLIENT: 'Client',
      QC: 'Quality Analyst',
      ADVOCATE: 'Legal Partner',
    };
    return labels[role] || role;
  };

  const filteredActivityLogs = (() => {
    if (!activity_logs) return [];
    const activeCmId = selectedCmId || (case_managers && case_managers[0]?.id);
    if (!activeCmId) return activity_logs.slice(0, 4);
    return activity_logs.filter((log) => String(log.user_id) === String(activeCmId)).slice(0, 4);
  })();

  return (
    <CaseManagerLayout>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
            Welcome {getUserDisplayName(user)}
          </Typography>
          <NotificationBell />
        </Box>

        {/* Top Row - 50-50 Split: Left = Users by Role Pie Chart, Right = 2x2 Stat Cards Grid */}
        <Box mb={3} sx={{ display: 'flex', gap: 2.5, width: '100%', alignItems: 'stretch' }}>
          {/* Left 50%: Users by Role Distribution Pie Chart */}
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Paper sx={{ p: 2.5, borderRadius: '16px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1.5, fontSize: '1.05rem' }}>
                Users by Role Distribution
              </Typography>
              <Box sx={{ flex: 1, minHeight: 200, display: 'flex', justifyContent: 'center', alignItems: 'center', px: 1 }}>
                {user_statistics?.users_by_role && Object.keys(user_statistics.users_by_role).length > 0 ? (
                  <Pie
                    data={{
                      labels: Object.keys(user_statistics.users_by_role).map(getRoleLabel),
                      datasets: [
                        {
                          data: Object.values(user_statistics.users_by_role),
                          backgroundColor: ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#06b6d4', '#e11d48'],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'right',
                          align: 'center',
                          labels: {
                            font: { size: 12, weight: '600' },
                            padding: 14,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                          },
                        },
                      },
                      layout: {
                        padding: {
                          top: 10,
                          bottom: 10,
                          left: 5,
                          right: 12,
                        },
                      },
                    }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No user data available
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>

          {/* Right 50%: 2x2 Grid of 4 Stat Cards */}
          <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2.25, placeItems: 'center' }}>
            {statsData.map((stat, index) => (
              <Box key={index} sx={{ minWidth: 0, width: '100%', maxWidth: '345px', height: '112px' }}>
                <StatCard {...stat} dense />
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bottom Row - 50-50 Split: Left = Activity Logs (CM dropdown), Right = Approval Logs (TAT 50% & Deletion 50%) */}
        <Box sx={{ display: 'flex', gap: 3, width: '100%', alignItems: 'stretch' }}>
          
          {/* Left Section 50%: Activity Logs */}
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Paper sx={{ p: 3, pb: 3.5, borderRadius: '16px', height: '410px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)' }}>
              {/* Header with Case Manager Dropdown */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History sx={{ color: '#6366f1' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Activity Logs
                  </Typography>
                </Box>
                <FormControl size="small">
                  <Select
                    value={selectedCmId || (case_managers && case_managers[0]?.id) || ''}
                    onChange={(e) => setSelectedCmId(e.target.value)}
                    sx={{
                      minWidth: 180,
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {case_managers?.map((cm) => (
                      <MenuItem key={cm.id} value={cm.id}>
                        {cm.name || cm.email}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Activity Log Items (Latest 4) */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, justifyContent: filteredActivityLogs.length > 0 ? 'flex-start' : 'center' }}>
                {filteredActivityLogs.length > 0 ? (
                  filteredActivityLogs.map((log) => (
                    <Paper
                      key={log.id}
                      variant="outlined"
                      sx={{
                        p: 1.75,
                        px: 2,
                        borderRadius: '10px',
                        backgroundColor: '#f8fafc',
                        borderColor: '#e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px', lineHeight: 1.3 }}>
                          {log.details}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '11.5px', display: 'block', mt: 0.25 }}>
                          By <strong>{log.actor}</strong> ({log.role || 'Case Manager'})
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </Typography>
                    </Paper>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
                    No activity logs found for the selected Case Manager.
                  </Typography>
                )}
              </Box>

              {/* Show More link to Logs page */}
              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center', pt: 1, borderTop: '1px solid #f1f5f9' }}>
                <Button
                  size="small"
                  onClick={() => navigate('/super-admin/logs', { state: { cmId: selectedCmId } })}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: '#6366f1',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.08)' },
                  }}
                >
                  Show More →
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* Right Section 50%: Approval Logs (50-50 Split between TAT and Deletion) */}
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Paper sx={{ p: 3, pb: 3.5, borderRadius: '16px', height: '410px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)' }}>
              <Typography
                variant="h6"
                onClick={() => navigate('/super-admin/approvals')}
                sx={{
                  fontWeight: 700,
                  color: '#1e293b',
                  mb: 2.25,
                  cursor: 'pointer',
                  width: 'fit-content',
                  '&:hover': { color: '#6366f1' },
                }}
              >
                Approval Logs
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Case Deletion Change Logs */}
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    onClick={() => navigate('/super-admin/approvals')}
                    sx={{
                      fontWeight: 700,
                      color: '#334155',
                      fontSize: '13px',
                      mb: 1.5,
                      pl: 1,
                      borderLeft: '3px solid #ef4444',
                      cursor: 'pointer',
                      width: 'fit-content',
                      '&:hover': { color: '#ef4444' },
                    }}
                  >
                    Case Deletion Logs
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1 }}>
                    {deletion_logs && deletion_logs.length > 0 ? (
                      deletion_logs.slice(0, 3).map((del) => (
                        <Paper
                          key={del.id}
                          variant="outlined"
                          onClick={() => navigate('/super-admin/approvals', { state: { requestId: del.id } })}
                          sx={{
                            p: 1.5,
                            borderRadius: '10px',
                            backgroundColor: del.status === 'APPROVED' ? '#f0fdf4' : del.status === 'REJECTED' ? '#fef2f2' : '#ffffff',
                            borderColor: del.status === 'APPROVED' ? '#bbf7d0' : del.status === 'REJECTED' ? '#fecaca' : '#e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              borderColor: del.status === 'APPROVED' ? '#86efac' : del.status === 'REJECTED' ? '#fca5a5' : '#cbd5e1',
                              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)',
                              transform: 'translateY(-1px)',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: del.status === 'APPROVED' ? '#15803d' : del.status === 'REJECTED' ? '#b91c1c' : '#991b1b', fontSize: '13px' }}>
                              Case #{del.case_number || del.case_id}
                            </Typography>
                            {del.status !== 'APPROVED' && del.status !== 'REJECTED' && (
                              <Chip
                                label={del.status}
                                size="small"
                                color="warning"
                                sx={{ height: 20, fontSize: '10.5px', fontWeight: 700 }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: '#475569', display: 'block', fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Reason: {del.reason}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '10.5px', mt: 0.25, display: 'block' }}>
                            {del.requested_at ? new Date(del.requested_at).toLocaleDateString() : 'N/A'} • {del.requested_by}
                          </Typography>
                        </Paper>
                      ))
                    ) : (
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic', display: 'block', mt: 2 }}>
                        No case deletion logs available.
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>

        </Box>
      </Box>
    </CaseManagerLayout>
  );
};

export default SuperAdminDashboard;
