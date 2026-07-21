import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  InputBase,
  IconButton,
  Box,
  Badge,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Divider,
  Button,
} from '@mui/material';
import { Search, Notifications, History } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const AdminNavbar = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoadingActivities(true);
      const response = await api.get('/audit-logs', { params: { limit: 8 } });
      setActivities(response.data || []);
    } catch (error) {
      console.error('Failed to load recent activities:', error);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleNotificationsClick = (event) => {
    setAnchorEl(event.currentTarget);
    fetchActivities();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const formatActivityTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOpen = Boolean(anchorEl);

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
        <IconButton onClick={handleNotificationsClick}>
          <Badge color="primary" variant={activities.length > 0 ? 'dot' : 'standard'}>
            <Notifications sx={{ color: '#666' }} />
          </Badge>
        </IconButton>

        <Popover
          open={isOpen}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: 1.5,
              width: 390,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
              overflow: 'hidden',
            },
          }}
        >
          <Box sx={{ px: 2.25, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                bgcolor: '#eef2ff',
                color: '#4c6ef5',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <History fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                Recent Activity
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b7280' }}>
                Latest system events
              </Typography>
            </Box>
          </Box>
          <Divider />

          {loadingActivities ? (
            <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={26} />
            </Box>
          ) : activities.length === 0 ? (
            <Box sx={{ px: 2.25, py: 4 }}>
              <Typography sx={{ color: '#6b7280', textAlign: 'center' }}>
                No recent activity found.
              </Typography>
            </Box>
          ) : (
            <List disablePadding sx={{ maxHeight: 360, overflow: 'auto' }}>
              {activities.map((activity, index) => (
                <ListItem
                  key={`${activity.event_time}-${activity.event_type}-${index}`}
                  alignItems="flex-start"
                  sx={{
                    px: 2.25,
                    py: 1.5,
                    borderBottom: index < activities.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>
                        {activity.description || activity.event_type}
                      </Typography>
                    }
                    secondary={
                      <Typography component="span" sx={{ display: 'block', mt: 0.5, fontSize: 12.5, color: '#6b7280' }}>
                        {activity.actor || 'System'} - {formatActivityTime(activity.event_time)}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Divider />
          <Box sx={{ p: 1.25, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={() => {
                handleClose();
                navigate('/admin/audit-logs');
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              View Audit Logs
            </Button>
          </Box>
        </Popover>
      </Toolbar>
    </AppBar>
  );
};

export default AdminNavbar;
