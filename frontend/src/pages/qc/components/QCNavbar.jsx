import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import QCNotificationBell from './QCNotificationBell';

const QCNavbar = () => {
  const { user } = useAuth();
  const location = useLocation();

  let pageTitle = 'QC Portal';
  if (location.pathname === '/qc/dashboard') {
    const name = user?.first_name && user?.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : user?.username || 'QC';
    pageTitle = `Welcome ${name}`;
  } else if (location.pathname === '/qc/reports') {
    pageTitle = 'Reports';
  } else if (location.pathname === '/qc/logs') {
    pageTitle = 'Activity Logs';
  }

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: '#34495e',
        borderBottom: '1px solid rgba(236, 240, 241, 0.1)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', py: location.pathname === '/qc/dashboard' ? 0 : 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {location.pathname === '/qc/dashboard' ? (
            <Typography variant="h6" sx={{ color: '#ecf0f1', fontWeight: 600 }}>
              {pageTitle}
            </Typography>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(236, 240, 241, 0.7)', fontSize: '12px', mb: 0.2 }}>
                Home / {pageTitle}
              </Typography>
              <Typography variant="h5" sx={{ color: '#ecf0f1', fontWeight: 700, letterSpacing: '-0.5px' }}>
                {pageTitle}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QCNotificationBell iconColor="#ecf0f1" />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default QCNavbar;
