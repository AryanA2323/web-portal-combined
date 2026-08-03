import { Box } from '@mui/material';
import { CaseManagerSidebar, CaseManagerNavbar } from '../../../components/case_manager';
import { useAuth } from '../../../context';

const CaseManagerLayout = ({ children }) => {
  const { user } = useAuth();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <CaseManagerSidebar user={user} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CaseManagerNavbar />
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

export default CaseManagerLayout;
