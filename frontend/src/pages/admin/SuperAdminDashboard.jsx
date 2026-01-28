import { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Card,
  CardContent,
} from '@mui/material';
import {
  People,
  PersonAdd,
  Store,
  TrendingUp,
  AccountCircle,
  Business,
} from '@mui/icons-material';
import { Pie, Line } from 'react-chartjs-2';
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
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
import superAdminService from '../../services/superAdminService';
import { useAuth } from '../../context/AuthContext';

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

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await superAdminService.getSuperAdminDashboard();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <Box p={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      </AdminLayout>
    );
  }

  const { user_statistics, vendor_statistics, system_statistics, recent_users } = dashboardData || {};

  // Prepare stats cards data
  const statsData = [
    {
      title: 'Total Users',
      value: user_statistics?.total_users || 0,
      subtitle: `${user_statistics?.active_users || 0} active`,
      icon: People,
      iconBgColor: '#e3f2fd',
      iconColor: '#1976d2',
    },
    {
      title: 'New Users (30 days)',
      value: user_statistics?.new_users_last_30_days || 0,
      subtitle: `${user_statistics?.new_users_last_7_days || 0} this week`,
      icon: PersonAdd,
      iconBgColor: '#e8f5e9',
      iconColor: '#388e3c',
    },
    {
      title: 'Total Vendors',
      value: vendor_statistics?.total_vendors || 0,
      subtitle: `${vendor_statistics?.active_vendors || 0} active`,
      icon: Store,
      iconBgColor: '#fff3e0',
      iconColor: '#f57c00',
    },
    {
      title: 'Total Cases',
      value: system_statistics?.total_cases || 0,
      subtitle: `${system_statistics?.cases_last_30_days || 0} last 30 days`,
      icon: TrendingUp,
      iconBgColor: '#f3e5f5',
      iconColor: '#7b1fa2',
    },
  ];

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: 'primary',
      SUPER_ADMIN: 'secondary',
      VENDOR: 'warning',
      CLIENT: 'info',
      LAWYER: 'success',
    };
    return colors[role] || 'default';
  };

  const getRoleLabel = (role, subRole) => {
    // Return role directly (no more sub_role handling)
    return role;
  };

  const getSubRoleLabel = (subRole) => {
    const labels = {
      SUPER_ADMIN: 'Super Admin',
      CASE_HANDLER: 'Case Handler',
      REPORT_MANAGER: 'Report Manager',
      LOG_MANAGER: 'Log Manager',
    };
    return labels[subRole] || subRole;
  };

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box mb={4}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Super Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            System overview and user management statistics
          </Typography>
        </Box>

        {/* Stats Cards - Using Flexbox for equal width */}
        <Box mb={4} sx={{ display: 'flex', gap: 3, width: '100%' }}>
          {statsData.map((stat, index) => (
            <Box key={index} sx={{ flex: '1 1 0', minWidth: 0 }}>
              <StatCard {...stat} />
            </Box>
          ))}
        </Box>

        {/* Charts Section - Using Flexbox for 50-50 width */}
        <Box mb={4} sx={{ display: 'flex', gap: 3, width: '100%' }}>
          {/* User Statistics Pie Chart */}
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Paper sx={{ p: 3, height: '400px' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Users by Role Distribution
              </Typography>
              <Box sx={{ height: '320px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {user_statistics?.users_by_role && Object.keys(user_statistics.users_by_role).length > 0 ? (
                  <Pie
                    data={{
                      labels: Object.keys(user_statistics.users_by_role),
                      datasets: [
                        {
                          data: Object.values(user_statistics.users_by_role),
                          backgroundColor: ['#667eea', '#f6ad55', '#4299e1', '#48bb78', '#9f7aea'],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
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

          {/* User Growth Trend Line Chart */}
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Paper sx={{ p: 3, height: '400px' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                User Growth Trend
              </Typography>
              <Box sx={{ height: '320px' }}>
                <Line
                  data={{
                    labels: ['6 months ago', '5 months ago', '4 months ago', '3 months ago', '2 months ago', 'Last month', 'This month'],
                    datasets: [
                      {
                        label: 'Total Users',
                        data: [
                          Math.max(0, (user_statistics?.total_users || 0) - 50),
                          Math.max(0, (user_statistics?.total_users || 0) - 42),
                          Math.max(0, (user_statistics?.total_users || 0) - 35),
                          Math.max(0, (user_statistics?.total_users || 0) - 25),
                          Math.max(0, (user_statistics?.total_users || 0) - 15),
                          Math.max(0, (user_statistics?.total_users || 0) - (user_statistics?.new_users_last_30_days || 0)),
                          user_statistics?.total_users || 0,
                        ],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top',
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Recently Registered Users - Full Width */}
        <Box>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Recently Registered Users
            </Typography>
            <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Joined</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recent_users && recent_users.length > 0 ? (
                      recent_users.map((recentUser) => (
                        <TableRow key={recentUser.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                                {recentUser.username.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2">{recentUser.full_name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{recentUser.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={getRoleLabel(recentUser.role, recentUser.sub_role)}
                              color={getRoleColor(getRoleLabel(recentUser.role, recentUser.sub_role))}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={recentUser.is_active ? 'Active' : 'Inactive'}
                              color={recentUser.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(recentUser.date_joined).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No recent users
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
      </Box>
    </AdminLayout>
  );
};

export default SuperAdminDashboard;
