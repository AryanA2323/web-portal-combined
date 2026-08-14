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
  Store,
  People,
  AutoAwesome,
  Gavel,
  CheckCircle,
  Assessment,
  History,
  Settings,
  Logout,
  SwapHoriz,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import companyLogo from '../../SS_logo.jpg';

const DRAWER_WIDTH = 240;

const allMenuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Dashboard, path: '/case_manager/dashboard' },
  { id: 'cases', label: 'Cases', icon: FolderOpen, path: '/case_manager/cases' },
  { id: 'users', label: 'Users', icon: People, path: '/case_manager/users' },
  { id: 'clients', label: 'Clients', icon: Store, path: '/case_manager/clients' },
  { id: 'ai-brief', label: 'AI Brief Review', icon: AutoAwesome, path: '/case_manager/ai-brief' },
  { id: 'legal-review', label: 'Legal Review', icon: Gavel, path: '/case_manager/legal-review' },
  { id: 'completed-cases', label: 'Completed Cases', icon: CheckCircle, path: '/case_manager/completed-cases' },
  { id: 'reports', label: 'Reports', icon: Assessment, path: '/case_manager/reports' },
  { id: 'audit-logs', label: 'Audit Logs', icon: History, path: '/case_manager/audit-logs' },
  { id: 'tat-changes', label: 'Approvals', icon: SwapHoriz, path: '/super-admin/approvals' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/case_manager/settings' },
];

const getUserFullName = (u) => {
  if (!u) return 'User';
  const nameParts = [u.first_name, u.last_name].filter(Boolean);
  if (nameParts.length > 0) {
    return nameParts.join(' ');
  }
  return u.email || 'User';
};

const getUserRoleLabel = (u) => {
  if (!u) return 'Case Manager';
  const role = (u.role || '').toLowerCase();
  const subRole = (u.sub_role || '').toLowerCase();

  if (role === 'super_admin' || subRole === 'super_admin') {
    return 'Super Admin';
  }

  const roleText = u.role
    ? u.role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Case Manager';

  if (u.sub_role && subRole !== role && !role.toLowerCase().includes(subRole)) {
    const subRoleText = u.sub_role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return `${roleText} • ${subRoleText}`;
  }

  return roleText;
};

const CaseManagerSidebar = () => {
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
              {getUserFullName(user)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: '#666',
                fontSize: '12px',
                display: 'block',
              }}
            >
              {getUserRoleLabel(user)}
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

export default CaseManagerSidebar;
