import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Avatar,
  Divider,
  Button,
} from '@mui/material';
import { useAuth } from '../../../context/AuthContext';
import {
  Dashboard,
  Assessment,
  History,
  Logout,
  Gavel,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import companyLogo from '../../../SS_logo.jpg';

const DRAWER_WIDTH = 240;

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Dashboard, path: '/qc/dashboard' },
  { id: 'reports', label: 'Reports', icon: Assessment, path: '/qc/reports' },
  { id: 'logs', label: 'Logs', icon: History, path: '/qc/logs' },
];

const QCSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid #e0e0e0',
          backgroundColor: '#fff',
        },
      }}
    >
      {/* Logo/Header */}
      <Box sx={{ height: { xs: 96, md: 112, xl: 96 }, px: 2, pt: { xs: 3, md: 4.2, xl: 3 }, pb: { xs: 0, md: 1.5, xl: 0 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box
          component="img"
          src={companyLogo}
          alt="Shoveltech Solutions"
          sx={{
            height: 44,
            width: '100%',
            objectFit: 'contain',
            transform: 'scale(1.08)',
          }}
        />
      </Box>

      {/* Navigation Menu */}
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: '8px',
                  py: 1.2,
                  backgroundColor: isActive ? '#e0e7ff' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive ? '#e0e7ff' : '#f5f5f5',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon
                    sx={{
                      color: isActive ? '#667eea' : '#666',
                      fontSize: 22,
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#667eea' : '#333',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* User Profile */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              backgroundColor: '#667eea',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {user?.first_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'L'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#333',
              }}
            >
              {user?.first_name || user?.last_name
                ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
                : user?.email || 'User'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: '#666',
                fontSize: '12px',
                display: 'block',
                textTransform: 'capitalize',
              }}
            >
              {user?.role === 'QC' ? 'Quality Analyst' : user?.role || 'Quality Analyst'}
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Logout sx={{ fontSize: 18 }} />}
          onClick={logout}
          sx={{
            borderColor: '#e0e0e0',
            color: '#666',
            fontSize: '13px',
            textTransform: 'none',
            py: 0.8,
            '&:hover': {
              borderColor: '#667eea',
              backgroundColor: '#e0e7ff',
              color: '#667eea',
            },
          }}
        >
          Logout
        </Button>
      </Box>
    </Drawer>
  );
};

export default QCSidebar;
