import { Box } from '@mui/material';
import LawyerSidebar from './LawyerSidebar';
import LawyerNavbar from './LawyerNavbar';

const LawyerLayout = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <LawyerSidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <LawyerNavbar />
        <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default LawyerLayout;
