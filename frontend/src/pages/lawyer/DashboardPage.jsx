import { Box, Typography, Paper, Card, CardContent, Divider } from '@mui/material';
import { Assessment, CheckCircle, Pending, Archive, Description, CheckCircleOutline, CancelOutlined } from '@mui/icons-material';
import LawyerLayout from './components/LawyerLayout';

const StatCard = ({ title, value, icon: Icon, color, bgColor }) => (
  <Card sx={{ height: '100%', boxShadow: 2 }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: color, mb: 1 }}>
            {value}
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
  const stats = [
    { title: 'Total Reports', value: '108', icon: Assessment, color: '#3498db', bgColor: '#e3f2fd' },
    { title: 'Pending Review', value: '33', icon: Pending, color: '#f39c12', bgColor: '#fff3e0' },
    { title: 'Reviewed', value: '75', icon: CheckCircle, color: '#27ae60', bgColor: '#e8f5e9' },
    { title: 'Archived', value: '12', icon: Archive, color: '#95a5a6', bgColor: '#f5f5f5' },
  ];

  const recentActivities = [
    { id: 1, vendor: 'Vendor A', action: 'submitted a Contract Dispute report', client: 'Jane Smith', time: '2 hours ago', type: 'submitted' },
    { id: 2, action: 'accepted a Business Litigation report', client: 'ACME Corp.', time: '4 hours ago', type: 'accepted' },
    { id: 3, vendor: 'Vendor C', action: 'submitted a Real Estate report', client: 'John Doe', time: '1 day ago', type: 'submitted' },
    { id: 4, action: 'rejected a Personal Injury report', client: 'Juan Doe', time: '2 days ago', type: 'rejected' },
    { id: 5, action: 'accepted a Family Law report', client: 'Alice Johnson', time: '3 days ago', type: 'accepted' },
  ];

  const getActivityIcon = (type) => {
    switch (type) {
      case 'accepted':
        return <CheckCircleOutline sx={{ color: '#27ae60', fontSize: 20 }} />;
      case 'rejected':
        return <CancelOutlined sx={{ color: '#e74c3c', fontSize: 20 }} />;
      default:
        return <Description sx={{ color: '#3498db', fontSize: 20 }} />;
    }
  };

  return (
    <LawyerLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 3, color: '#2c3e50' }}>
          Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
          {stats.map((stat, index) => (
            <Box key={index} sx={{ flex: 1 }}>
              <StatCard {...stat} />
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, color: '#2c3e50' }}>
            Recent Activity
          </Typography>
          <Paper sx={{ p: 3 }}>
            {recentActivities.map((activity, index) => (
              <Box key={activity.id}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, mt: 0.5 }}>
                    {getActivityIcon(activity.type)}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: '#333' }}>
                      {activity.vendor && (
                        <>
                          <strong>{activity.vendor}</strong> {activity.action}
                        </>
                      )}
                      {!activity.vendor && (
                        <>
                          <strong>You</strong> {activity.action}
                        </>
                      )}
                      {activity.client && (
                        <>
                          {' '}for <strong>{activity.client}</strong>
                        </>
                      )}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.5 }}>
                      {activity.time}
                    </Typography>
                  </Box>
                </Box>
                {index < recentActivities.length - 1 && <Divider sx={{ my: 2 }} />}
              </Box>
            ))}
          </Paper>
        </Box>
      </Box>
    </LawyerLayout>
  );
};

export default DashboardPage;
