import { Box } from '@mui/material';
import { AdminSidebar, AdminNavbar } from '../../../components/admin';
import { useAuth } from '../../../context';

const AdminLayout = ({ children }) => {
  const { user } = useAuth();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <AdminSidebar user={user} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AdminNavbar />
        <Box
          component="main"
          sx={{
            flex: 1,
            mt: '64px',
            p: 3,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
