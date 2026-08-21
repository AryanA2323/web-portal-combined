import { useState, useEffect, useCallback } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Typography,
  List,
  ListItem,
  CircularProgress,
  Divider,
  Button,
  Box,
  Chip,
} from '@mui/material';
import { Notifications } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const READ_STORAGE_KEY = 'read_notifications_ids';

const NotificationBell = ({ iconColor = '#666', iconSx = {} }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.sub_role?.toUpperCase() === 'SUPER_ADMIN' || user?.role?.toUpperCase() === 'SUPER_ADMIN';

  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem(READ_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveReadIds = (ids) => {
    setReadIds(ids);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      console.error('Failed to save read notification state:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const endpoint = isSuperAdmin ? '/super-admin/notifications' : '/audit-logs';
      const response = await api.get(endpoint, { params: { limit: 25 } });
      const rawData = response.data || [];

      const stored = localStorage.getItem(READ_STORAGE_KEY);
      const currentReadIds = stored ? JSON.parse(stored) : [];

      const formatted = rawData.map((item, index) => {
        const id = item.id || `${item.event_time}-${item.event_type}-${index}`;
        return {
          id,
          description: item.description || item.event_type,
          actor: item.actor || 'System',
          event_time: item.event_time,
          event_type: item.event_type,
          target_user_email: item.target_user_email,
          target_user_id: item.target_user_id,
          case_id: item.case_id,
          is_read: currentReadIds.includes(id),
        };
      });

      // Guarantee latest logs are on top (descending timestamp sort)
      formatted.sort((a, b) => {
        const timeA = a.event_time ? new Date(a.event_time).getTime() : 0;
        const timeB = b.event_time ? new Date(b.event_time).getTime() : 0;
        return timeB - timeA;
      });

      // Deduplicate notifications (e.g. USER_CREATED duplicate entries for the same target)
      const seenKeys = new Set();
      const deduplicated = formatted.filter((item) => {
        const evType = (item.event_type || '').toUpperCase();
        let targetKey = item.target_user_email || item.target_user_id || '';
        if (!targetKey && item.description && item.description.includes("'")) {
          const match = item.description.match(/'([^']+)'/);
          if (match) targetKey = match[1].toLowerCase();
        }
        if (evType === 'USER_CREATED' && targetKey) {
          const key = `USER_CREATED-${targetKey.toLowerCase()}`;
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
        }
        return true;
      });

      setNotifications(deduplicated);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh notifications every 30 seconds and on tab focus
  useAutoRefresh(fetchNotifications, 30000);

  const handleNotificationsClick = (event) => {
    setAnchorEl(event.currentTarget);
    fetchNotifications();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    saveReadIds(allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleToggleRead = (id) => {
    let updatedReadIds;
    if (readIds.includes(id)) {
      updatedReadIds = readIds.filter((item) => item !== id);
    } else {
      updatedReadIds = [...readIds, id];
    }
    saveReadIds(updatedReadIds);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: !n.is_read } : n))
    );
  };

  const handleNotificationItemClick = (item) => {
    if (!item.is_read) {
      handleToggleRead(item.id);
    }
    handleClose();

    const evType = (item.event_type || '').toUpperCase();
    const desc = item.description || '';

    // 1. Client Notifications -> Navigate to Clients page
    if (
      evType.startsWith('CLIENT_') ||
      desc.toLowerCase().includes('client')
    ) {
      let clientQuery = '';
      if (desc.includes("'")) {
        const match = desc.match(/'([^']+)'/);
        if (match) clientQuery = match[1];
      }
      if (!clientQuery && desc.includes("(")) {
        const match = desc.match(/\(([^)]+)\)/);
        if (match) clientQuery = match[1];
      }
      const isCreateAction = evType.includes('CREATED') || desc.toLowerCase().includes('created');
      navigate('/case_manager/clients', {
        state: {
          openClientQuery: clientQuery || desc,
          highlightFields: !isCreateAction,
          highlightDesc: desc,
        }
      });
      return;
    }

    // 2. User Created / Modified / Deleted notifications -> Navigate to Users page and open modal!
    if (
      (evType.startsWith('USER_') ||
      desc.toLowerCase().includes('user') ||
      item.target_user_email) &&
      !evType.startsWith('CLIENT_') &&
      !desc.toLowerCase().includes('client')
    ) {
      let userQuery = item.target_user_email;
      if (desc.includes("'")) {
        const match = desc.match(/'([^']+)'/);
        if (match) {
          const quotedName = match[1];
          if (!userQuery || userQuery === item.actor || (item.actor && userQuery.includes(item.actor))) {
            userQuery = quotedName;
          }
        }
      }
      if (!userQuery) {
        userQuery = item.target_user_email || item.actor || '';
      }
      const isUserAction = evType.startsWith('USER_') || desc.toLowerCase().includes('user') || Boolean(item.target_user_email);

      navigate('/case_manager/users', {
        state: {
          openUserEmail: userQuery,
          highlightPermissions: isUserAction,
          permissionDesc: isUserAction ? desc : undefined,
        },
      });
      return;
    }

    // 3. Approvals / Rejections (Cases / Change Management)
    if (
      evType.startsWith('CASE_DELETION') ||
      evType.includes('APPROVAL') ||
      evType.includes('REJECT') ||
      item.case_id
    ) {
      if (isSuperAdmin && evType.startsWith('CASE_DELETION')) {
        const match = item.id ? item.id.toString().match(/-(\d+)$/) : null;
        const reqId = match ? match[1] : null;

        navigate('/super-admin/approvals', {
          state: {
            requestId: reqId
          }
        });
        setAnchorEl(null);
        return;
      }
      
      let caseSearch = item.case_id || '';
      if (!caseSearch && desc.includes('#')) {
        const match = desc.match(/#(\d+)/);
        if (match) caseSearch = match[1];
      }
      navigate('/case_manager/cases', {
        state: {
          search: String(caseSearch),
          openCaseId: caseSearch,
        },
      });
      return;
    }

    // Fallback
    if (isSuperAdmin) {
      navigate('/case_manager/users');
    } else {
      navigate('/case_manager/cases');
    }
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'UNREAD') return !item.is_read;
    if (filter === 'READ') return item.is_read;
    return true;
  });

  const isOpen = Boolean(anchorEl);

  return (
    <>
      <IconButton onClick={handleNotificationsClick} size="medium">
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <Notifications sx={{ color: iconColor, ...iconSx }} />
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
            width: 430,
            maxWidth: 'calc(100vw - 32px)',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2.25, py: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
              {isSuperAdmin ? 'Super Admin Activity' : 'Notifications'}
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                color="error"
                sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
              />
            )}
          </Box>
          <Button
            size="small"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 12.5,
              color: '#667eea',
              '&:disabled': { color: '#94a3b8' },
            }}
          >
            Mark all as read
          </Button>
        </Box>

        <Divider />

        {/* Content List */}
        {loading ? (
          <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={26} />
          </Box>
        ) : filteredNotifications.length === 0 ? (
          <Box sx={{ px: 2.25, py: 4 }}>
            <Typography sx={{ color: '#6b7280', textAlign: 'center' }}>
              {filter === 'UNREAD'
                ? 'No unread notifications.'
                : filter === 'READ'
                  ? 'No read notifications.'
                  : 'No notifications found.'}
            </Typography>
          </Box>
        ) : (
          <List
            disablePadding
            sx={{
              maxHeight: 380,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            {filteredNotifications.map((item, index) => (
              <ListItem
                key={item.id}
                alignItems="flex-start"
                onClick={() => handleNotificationItemClick(item)}
                sx={{
                  px: 2.25,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  gap: 1.5,
                  cursor: 'pointer',
                  backgroundColor: item.is_read ? 'transparent' : '#f0f4ff',
                  borderBottom: index < filteredNotifications.length - 1 ? '1px solid #f1f5f9' : 'none',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: item.is_read ? '#f8fafc' : '#e0e7ff',
                  },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 13.5,
                      fontWeight: item.is_read ? 500 : 700,
                      color: item.is_read ? '#334155' : '#0f172a',
                      lineHeight: 1.3,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {item.description}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ display: 'block', mt: 0.5, fontSize: 12, color: '#64748b' }}
                  >
                    By {item.actor} • {formatActivityTime(item.event_time)}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleRead(item.id);
                  }}
                  sx={{
                    fontSize: 11.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    color: item.is_read ? '#64748b' : '#2563eb',
                    '&:hover': {
                      backgroundColor: item.is_read ? '#f1f5f9' : 'rgba(37, 99, 235, 0.1)',
                    },
                  }}
                >
                  {item.is_read ? 'Mark as unread' : 'Mark as read'}
                </Button>
              </ListItem>
            ))}
          </List>
        )}

        <Divider />

        {/* Footer with Read/Unread Filter on left and View Action on right */}
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Chip
              label="All"
              size="small"
              clickable
              onClick={() => setFilter('ALL')}
              color={filter === 'ALL' ? 'primary' : 'default'}
              variant={filter === 'ALL' ? 'filled' : 'outlined'}
              sx={{ height: 24, fontSize: 11.5, fontWeight: 600 }}
            />
            <Chip
              label="Unread"
              size="small"
              clickable
              onClick={() => setFilter('UNREAD')}
              color={filter === 'UNREAD' ? 'primary' : 'default'}
              variant={filter === 'UNREAD' ? 'filled' : 'outlined'}
              sx={{ height: 24, fontSize: 11.5, fontWeight: 600 }}
            />
            <Chip
              label="Read"
              size="small"
              clickable
              onClick={() => setFilter('READ')}
              color={filter === 'READ' ? 'primary' : 'default'}
              variant={filter === 'READ' ? 'filled' : 'outlined'}
              sx={{ height: 24, fontSize: 11.5, fontWeight: 600 }}
            />
          </Box>
          <Button
            size="small"
            onClick={() => {
              handleClose();
              if (isSuperAdmin) {
                navigate('/super-admin/approvals');
              } else {
                navigate('/case_manager/audit-logs');
              }
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isSuperAdmin ? 'View Approvals' : 'View Audit Logs'}
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationBell;
