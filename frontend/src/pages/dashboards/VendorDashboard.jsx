import { Container, Paper, Typography, Box, Button } from '@mui/material';
import { Engineering, Logout } from '@mui/icons-material';
import { useAuth } from '../../context';
import { useNavigate } from 'react-router-dom';

const VendorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-blue-50">
      <Box className="bg-blue-600 text-white p-4 shadow-md">
        <Container maxWidth="lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Engineering />
              <Typography variant="h6">Vendor Portal</Typography>
            </div>
            <div className="flex items-center gap-4">
              <Typography variant="body2">
                Welcome, {user?.email || 'Vendor'}
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
          <Typography variant="h4" className="mb-4 text-blue-800">
            Vendor Dashboard
          </Typography>
          <Typography variant="body1" className="text-gray-600">
            🔧 Manage and resolve incidents here.
          </Typography>
        </Paper>
      </Container>
    </div>
  );
};

export default VendorDashboard;
