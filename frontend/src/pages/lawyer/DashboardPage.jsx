import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Card, CardContent, Divider, CircularProgress, Alert } from '@mui/material';
import { Assessment, CheckCircle, Pending, Cancel, Description, CheckCircleOutline, CancelOutlined } from '@mui/icons-material';
import LawyerLayout from './components/LawyerLayout';
import api from '../../services/api';

const StatCard = ({ title, value, icon: Icon, color, bgColor, loading }) => (
  <Card sx={{ height: '100%', boxShadow: 2 }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: color, mb: 1 }}>
            {loading ? <CircularProgress size={24} /> : value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
        <Box
          sx={{
            backgroundColor: bgColor,
            borderRadius: '12px',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ color: color, fontSize: 32 }} />
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const DashboardPage = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  });
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, reportsRes] = await Promise.all([
          api.get('/lawyer/reports/stats'),
          api.get('/lawyer/reports'),
        ]);
        setStats(statsRes.data || { total: 0, pending: 0, accepted: 0, rejected: 0 });
        // Get last 5 reports for recent activity
        setRecentReports((reportsRes.data || []).slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = [
    { title: 'Total Reports', value: stats.total, icon: Assessment, color: '#3498db', bgColor: '#e3f2fd' },
    { title: 'Pending Review', value: stats.pending, icon: Pending, color: '#f39c12', bgColor: '#fff3e0' },
    { title: 'Accepted', value: stats.accepted, icon: CheckCircle, color: '#27ae60', bgColor: '#e8f5e9' },
    { title: 'Rejected', value: stats.rejected, icon: Cancel, color: '#e74c3c', bgColor: '#ffebee' },
  ];

  const getActivityIcon = (status) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircleOutline sx={{ color: '#27ae60', fontSize: 20 }} />;
      case 'REJECTED':
        return <CancelOutlined sx={{ color: '#e74c3c', fontSize: 20 }} />;
      default:
        return <Description sx={{ color: '#3498db', fontSize: 20 }} />;
    }
  };

  const getActivityText = (report) => {
    switch (report.status) {
      case 'ACCEPTED':
        return `You accepted the report for "${report.case_title}"`;
      case 'REJECTED':
        return `You rejected the report for "${report.case_title}"`;
      case 'ASSIGNED':
        return `Report assigned for "${report.case_title}" - pending review`;
      default:
        return `Report for "${report.case_title}"`;
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <LawyerLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 3, color: '#2c3e50' }}>
          Dashboard
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
          {statCards.map((stat, index) => (
            <Box key={index} sx={{ flex: 1 }}>
              <StatCard {...stat} loading={loading} />
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, color: '#2c3e50' }}>
            Recent Reports
          </Typography>
          <Paper sx={{ p: 3 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : recentReports.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, color: '#666' }}>
                <Description sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography color="text.secondary">No reports assigned yet</Typography>
              </Box>
            ) : (
              recentReports.map((report, index) => (
                <Box key={report.id}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, mt: 0.5 }}>
                      {getActivityIcon(report.status)}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ color: '#333' }}>
                        {getActivityText(report)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#667eea', fontWeight: 600 }}>
                        {report.case_number}
                      </Typography>
                      {report.client_name && (
                        <Typography variant="caption" sx={{ color: '#666', ml: 1 }}>
                          | Client: {report.client_name}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.5 }}>
                        {formatTimeAgo(report.reviewed_at || report.assigned_at || report.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                  {index < recentReports.length - 1 && <Divider sx={{ my: 2 }} />}
                </Box>
              ))
            )}
          </Paper>
        </Box>
      </Box>
    </LawyerLayout>
  );
};

export default DashboardPage;
