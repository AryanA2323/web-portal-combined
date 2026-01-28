import { AppBar, Toolbar, Typography, IconButton, Box, InputBase } from '@mui/material';
import { Search, Notifications } from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';

const LawyerNavbar = () => {
  const { user } = useAuth();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: '#34495e',
        borderBottom: '1px solid rgba(236, 240, 241, 0.1)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ color: '#ecf0f1', fontWeight: 600 }}>
            {user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}, Esq.`
              : 'Lawyer Portal'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton sx={{ color: '#ecf0f1' }}>
            <Notifications />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default LawyerNavbar;
