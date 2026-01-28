import { AppBar, Toolbar, InputBase, IconButton, Box } from '@mui/material';
import { Search, Notifications } from '@mui/icons-material';

const AdminNavbar = () => {
  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: 240,
        width: 'calc(100% - 240px)',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* Search Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            px: 2,
            py: 0.5,
            width: '400px',
          }}
        >
          <Search sx={{ color: '#999', mr: 1 }} />
          <InputBase
            placeholder="Search cases, vendors, users..."
            sx={{
              flex: 1,
              fontSize: '14px',
              '& input::placeholder': {
                color: '#999',
                opacity: 1,
              },
            }}
          />
        </Box>

        {/* Notification Bell */}
        <IconButton>
          <Notifications sx={{ color: '#666' }} />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default AdminNavbar;
