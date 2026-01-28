import { useState } from 'react';
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

const DRAWER_WIDTH = 240;

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Dashboard, path: '/lawyer/dashboard' },
  { id: 'reports', label: 'Reports', icon: Assessment, path: '/lawyer/reports' },
  { id: 'logs', label: 'Logs', icon: History, path: '/lawyer/logs' },
];

const LawyerSidebar = () => {
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
          backgroundColor: '#2c3e50',
          color: '#ecf0f1',
        },
      }}
    >
      {/* Logo/Header */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Gavel sx={{ color: '#3498db', fontSize: 32 }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', lineHeight: 1.2, color: '#ecf0f1' }}>
            LAWYER PORTAL
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(236, 240, 241, 0.1)' }} />

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
                  backgroundColor: isActive ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive ? 'rgba(52, 152, 219, 0.3)' : 'rgba(236, 240, 241, 0.1)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon
                    sx={{
                      color: isActive ? '#3498db' : '#95a5a6',
                      fontSize: 22,
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#3498db' : '#ecf0f1',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(236, 240, 241, 0.1)' }} />

      {/* User Profile */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              backgroundColor: '#3498db',
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
                color: '#ecf0f1',
              }}
            >
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.email || 'User'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: '#95a5a6',
                fontSize: '12px',
                display: 'block',
                textTransform: 'capitalize',
              }}
            >
              {user?.role || 'Lawyer'}
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Logout sx={{ fontSize: 18 }} />}
          onClick={logout}
          sx={{
            borderColor: 'rgba(236, 240, 241, 0.2)',
            color: '#ecf0f1',
            fontSize: '13px',
            textTransform: 'none',
            py: 0.8,
            '&:hover': {
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              color: '#3498db',
            },
          }}
        >
          Logout
        </Button>
      </Box>
    </Drawer>
  );
};

export default LawyerSidebar;
