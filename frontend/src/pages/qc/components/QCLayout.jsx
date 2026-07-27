import { Box } from '@mui/material';
import QCSidebar from './QCSidebar';
import QCNavbar from './QCNavbar';

const QCLayout = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <QCSidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <QCNavbar />
        <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default QCLayout;
