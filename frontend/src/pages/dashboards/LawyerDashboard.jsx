import { Container, Paper, Typography, Box, Button } from '@mui/material';
import { Gavel, Logout } from '@mui/icons-material';
import { useAuth } from '../../context';
import { useNavigate } from 'react-router-dom';

const LawyerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-green-50">
      <Box className="bg-green-600 text-white p-4 shadow-md">
        <Container maxWidth="lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gavel />
              <Typography variant="h6">Lawyer Portal</Typography>
            </div>
            <div className="flex items-center gap-4">
              <Typography variant="body2">
                Welcome, {user?.email || 'Lawyer'}
              </Typography>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<Logout />}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </div>
        </Container>
      </Box>
      
      <Container maxWidth="lg" className="py-8">
        <Paper className="p-6 rounded-xl">
          <Typography variant="h4" className="mb-4 text-green-800">
            Lawyer Dashboard
          </Typography>
          <Typography variant="body1" className="text-gray-600">
            ⚖️ Manage legal cases and incidents here.
          </Typography>
        </Paper>
      </Container>
    </div>
  );
};

export default LawyerDashboard;
