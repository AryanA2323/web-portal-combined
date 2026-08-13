import { Box } from '@mui/material';
import { CaseManagerSidebar } from '../../../components/case_manager';
import { useAuth } from '../../../context';

const CaseManagerLayout = ({ children, disablePadding = false }) => {
  const { user } = useAuth();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <CaseManagerSidebar user={user} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box
          component="main"
          sx={{
            flex: 1,
            p: disablePadding ? 0 : 3,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default CaseManagerLayout;
