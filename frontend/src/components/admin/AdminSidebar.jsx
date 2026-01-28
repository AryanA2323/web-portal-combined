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
import { useAuth } from '../../context/AuthContext';
import { getMenuItemsForUser } from '../../utils/constants';
import {
  Dashboard,
  FolderOpen,
  Email,
  Store,
  People,
  AutoAwesome,
  Gavel,
  Assessment,
  History,
  Settings,
  Logout,
  UploadFile,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;

const allMenuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Dashboard, path: '/admin/dashboard' },
  { id: 'cases', label: 'Cases', icon: FolderOpen, path: '/admin/cases' },
  { id: 'email-intake', label: 'Email Intake', icon: Email, path: '/admin/email-intake' },
  { id: 'process-document', label: 'Process Document', icon: UploadFile, path: '/admin/process-document' },
  { id: 'vendors', label: 'Vendors', icon: Store, path: '/admin/vendors' },
  { id: 'users', label: 'Users', icon: People, path: '/admin/users' },
  { id: 'ai-brief', label: 'AI Brief Review', icon: AutoAwesome, path: '/admin/ai-brief' },
  { id: 'legal-review', label: 'Legal Review', icon: Gavel, path: '/admin/legal-review' },
  { id: 'reports', label: 'Reports', icon: Assessment, path: '/admin/reports' },
  { id: 'audit-logs', label: 'Audit Logs', icon: History, path: '/admin/audit-logs' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
];

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Filter menu items based on user's sub-role permissions
  const allowedPaths = getMenuItemsForUser(user);
  const menuItems = allMenuItems.filter(item => allowedPaths.includes(item.path));

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
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '20px',
          }}
        >
          S
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', lineHeight: 1.2 }}>
            Shovel Screen
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', fontSize: '12px' }}>
            Admin Portal
          </Typography>
        </Box>
      </Box>

      <Divider />

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
                  backgroundColor: isActive ? '#f0f4ff' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive ? '#f0f4ff' : '#f5f5f5',
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
            {user?.first_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
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
              }}
            >
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
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
              {user?.role || 'Admin'}
              {user?.sub_role && ` • ${user.sub_role.replace('_', ' ')}`}
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
              backgroundColor: '#f0f4ff',
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

export default AdminSidebar;
