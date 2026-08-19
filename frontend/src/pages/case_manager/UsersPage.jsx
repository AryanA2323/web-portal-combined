import { getRoleStyle } from '../../utils/constants';
import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  InputAdornment,
  Avatar,
} from '@mui/material';
import {
  Edit,
  Delete,
  PersonAdd,
  CheckCircle,
  Cancel,
  Person,
  Email as EmailIcon,
  Lock,
  Badge,
  AccountCircle,
  Visibility,
  VisibilityOff,
  Logout as LogoutIcon,
  FiberManualRecord,
  Search as SearchIcon,
  Clear as ClearIcon,
  ManageAccounts,
  Close as CloseIcon,
  Security as SecurityIcon,
  VpnKey as KeyIcon,
  Computer as ComputerIcon,
  Shield as ShieldIcon,
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import api from '../../services/api';
import AlertMessage from '../../components/common/AlertMessage';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from '../../components/case_manager';

import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';

// All available case manager pages for permission toggles
const ADMIN_PAGES = [
  { path: '/case_manager/dashboard', label: 'Dashboard' },
  { path: '/case_manager/cases', label: 'Cases' },
  { path: '/case_manager/ai-brief', label: 'AI Brief Review' },
  { path: '/case_manager/legal-review', label: 'Legal Review' },
  { path: '/case_manager/reports', label: 'Reports' },
  { path: '/case_manager/audit-logs', label: 'Audit Logs' },
  { path: '/case_manager/settings', label: 'Settings' },
];

const UsersPage = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL'); // Role filter state
  const [timeFilter, setTimeFilter] = useState('ALL'); // Time filter state
  const [searchQuery, setSearchQuery] = useState(''); // Search query state

  // Sync filters from navigation state or URL query params
  useEffect(() => {
    const stateRole = location.state?.role ?? searchParams.get('role');
    const stateTime = location.state?.time ?? searchParams.get('time');
    const stateSearch = location.state?.search ?? searchParams.get('search');

    if (stateRole !== undefined && stateRole !== null) {
      setRoleFilter(stateRole);
    }
    if (stateTime !== undefined && stateTime !== null) {
      setTimeFilter(stateTime);
    }
    if (stateSearch !== undefined && stateSearch !== null) {
      setSearchQuery(stateSearch);
    }
  }, [location.state, searchParams]);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Read-only View User dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedViewUser, setSelectedViewUser] = useState(null);
  const [showViewPassword, setShowViewPassword] = useState(false);

  // Permission and field section highlight state
  const [highlightPermissions, setHighlightPermissions] = useState(false);
  const [highlightDesc, setHighlightDesc] = useState('');
  const highlightTimerRef = useRef(null);

  const clearPermissionsHighlight = () => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightPermissions(false);
    setHighlightDesc('');
  };

  const isFieldModified = (fieldKey) => {
    if (!highlightPermissions || !highlightDesc) return false;
    const descLower = highlightDesc.toLowerCase();
    
    if (fieldKey === 'role' && (descLower.includes('role') || descLower.includes('sub-role'))) return true;
    if (fieldKey === 'device_limit' && (descLower.includes('device') || descLower.includes('limit'))) return true;
    if (fieldKey === 'status' && (descLower.includes('status') || descLower.includes('active') || descLower.includes('inactive'))) return true;
    if (fieldKey === 'password' && (descLower.includes('password') || descLower.includes('pwd'))) return true;
    if (fieldKey === 'first_name' && descLower.includes('first name')) return true;
    if (fieldKey === 'last_name' && descLower.includes('last name')) return true;

    return false;
  };

  const getFieldSx = (fieldKey, defaultBg = '#f8fafc', defaultBorder = '#e2e8f0') => {
    const isMod = isFieldModified(fieldKey);
    return {
      p: 2,
      borderRadius: '10px',
      boxSizing: 'border-box',
      borderWidth: '1.5px',
      borderStyle: 'solid',
      backgroundColor: isMod ? '#ffedd5' : defaultBg,
      borderColor: isMod ? '#ea580c' : defaultBorder,
      boxShadow: isMod ? '0 0 14px rgba(234,88,12,0.45)' : 'none',
      transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
    };
  };

  const triggerPermissionsHighlight = (desc = '') => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightPermissions(true);
    setHighlightDesc(desc);

    // Scroll down to the specific modified field or section after dialog opens
    setTimeout(() => {
      let targetId = 'custom-permissions-section';
      if (desc) {
        const descLower = desc.toLowerCase();
        if (descLower.includes('first name')) targetId = 'field-first-name';
        else if (descLower.includes('last name')) targetId = 'field-last-name';
        else if (descLower.includes('role') || descLower.includes('sub-role')) targetId = 'field-role';
        else if (descLower.includes('device') || descLower.includes('limit')) targetId = 'field-device-limit';
        else if (descLower.includes('status') || descLower.includes('active') || descLower.includes('inactive')) targetId = 'field-status';
        else if (descLower.includes('password') || descLower.includes('pwd')) targetId = 'field-password';
      }
      const el = document.getElementById(targetId) || document.getElementById('custom-permissions-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);

    // Auto-remove highlight after 7.5 seconds
    highlightTimerRef.current = setTimeout(() => {
      setHighlightPermissions(false);
      setHighlightDesc('');
      highlightTimerRef.current = null;
    }, 7500);
  };

  const handleRowClick = (user) => {
    setSelectedViewUser(user);
    setShowViewPassword(false);
    setViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    clearPermissionsHighlight();
    setViewDialogOpen(false);
    setSelectedViewUser(null);
    setShowViewPassword(false);
  };

  // Create user dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    first_name: '',
    last_name: '',
    role: 'VENDOR',
    sub_role: '',
  });

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'VENDOR',
    sub_role: '',
    is_active: true,
    permissions: [],
    password: '',
    confirm_password: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);

  useEffect(() => {
    fetchUsers(false);
  }, []);

  // Auto-open target user info modal if navigated from notification
  useEffect(() => {
    if (users && users.length > 0 && location.state?.openUserEmail) {
      const targetQuery = String(location.state.openUserEmail).toLowerCase().trim();
      const matched = users.find(u =>
        u.email?.toLowerCase().includes(targetQuery) ||
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(targetQuery) ||
        u.username?.toLowerCase().includes(targetQuery)
      );
      if (matched) {
        handleRowClick(matched);
        if (location.state?.highlightPermissions) {
          triggerPermissionsHighlight(location.state?.permissionDesc);
        }
        // Clear the state so it doesn't reopen on tab switch / rerender
        navigate(location.pathname, { replace: true, state: { ...location.state, openUserEmail: undefined, highlightPermissions: undefined, permissionDesc: undefined } });
      }
    }
  }, [users, location.state, navigate, location.pathname]);

  const fetchUsers = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useAutoRefresh(fetchUsers);

  const handleOpenCreateDialog = () => {
    setCreateFormData({
      email: '',
      password: '',
      confirm_password: '',
      first_name: '',
      last_name: '',
      role: 'VENDOR',
      sub_role: '',
      device_limit: 1,
      permissions: [],
    });
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
    setError(null);
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
    setCreateFormData({
      email: '',
      password: '',
      confirm_password: '',
      first_name: '',
      last_name: '',
      role: 'VENDOR',
      sub_role: '',
      device_limit: 1,
      permissions: [],
    });
    setError(null);
  };

  const handleCreateInputChange = (field, value) => {
    setCreateFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateUser = async () => {
    try {
      // Validation

      if (!createFormData.email.trim()) {
        setError('Email is required');
        return;
      }
      if (!createFormData.password) {
        setError('Password is required');
        return;
      }
      if (createFormData.password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (createFormData.password !== createFormData.confirm_password) {
        setError('Passwords do not match');
        return;
      }

      setCreateLoading(true);
      setError(null);

      const payload = {
        email: createFormData.email.trim(),
        password: createFormData.password,
        first_name: createFormData.first_name.trim() || '',
        last_name: createFormData.last_name.trim() || '',
        role: createFormData.role,
        sub_role: createFormData.sub_role || '',
      };

      await api.post('/users', payload);

      setSuccessMessage('User created successfully!');
      handleCloseCreateDialog();
      await fetchUsers();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const errorMsg = err.response?.data?.error
        || err.response?.data?.detail
        || 'Failed to create user';
      setError(errorMsg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: user.role || 'VENDOR',
      is_active: user.is_active,
      device_limit: user.device_limit || 1,
      permissions: user.permissions || [],
      password: user.plain_password || '',
      new_password: '',
      confirm_new_password: '',
    });
    setShowEditPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    clearPermissionsHighlight();
    setEditDialogOpen(false);
    setSelectedUser(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      role: 'VENDOR',
      is_active: true,
      device_limit: 1,
      permissions: [],
      password: '',
      new_password: '',
      confirm_new_password: '',
    });
    setShowEditPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // If role is changed to non-CASE_MANAGER, clear permissions
      if (field === 'role' && value !== 'CASE_MANAGER') {
        updated.permissions = [];
      }

      return updated;
    });
  };

  const handlePermissionToggle = (pagePath) => {
    setFormData(prev => {
      const currentPermissions = prev.permissions || [];
      const hasPermission = currentPermissions.includes(pagePath);

      if (hasPermission) {
        return {
          ...prev,
          permissions: currentPermissions.filter(p => p !== pagePath),
        };
      } else {
        return {
          ...prev,
          permissions: [...currentPermissions, pagePath],
        };
      }
    });
  };

  const handleSaveUser = async () => {
    try {
      setSaveLoading(true);
      setError(null);

      const passwordChanged = Boolean(formData.new_password);

      if (passwordChanged) {
        if ((formData.new_password || '').length < 8) {
          setError('New Password must be at least 8 characters');
          setSaveLoading(false);
          return;
        }
        if (formData.new_password !== formData.confirm_new_password) {
          setError('Passwords do not match');
          setSaveLoading(false);
          return;
        }
      }

      // Prepare payload with only the necessary fields
      const payload = {
        first_name: formData.first_name || '',
        last_name: formData.last_name || '',
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active,
        device_limit: formData.device_limit ? parseInt(formData.device_limit, 10) : 1,
      };

      // Only include permissions for CASE_MANAGER users
      if (formData.role === 'CASE_MANAGER') {
        payload.permissions = Array.isArray(formData.permissions) ? formData.permissions : [];
      }

      if (passwordChanged) {
        payload.password = formData.new_password;
      }

      await api.put(`/users/${selectedUser.id}`, payload);

      await fetchUsers();

      // If editing the current user, refresh their session data
      if (currentUser && currentUser.id === selectedUser.id) {
        await refreshUser();
        setSuccessMessage('User updated successfully! Your permissions have been refreshed.');
      } else {
        setSuccessMessage('User updated successfully!');
      }

      handleCloseDialog();
      setError(null);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Update error:', err);
      console.error('Error response:', err.response);
      const errorMsg = err.response?.data?.error
        || err.response?.data?.detail
        || err.response?.data?.message
        || JSON.stringify(err.response?.data)
        || 'Failed to update user';
      setError(errorMsg);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      await fetchUsers();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleForceLogout = async (user) => {
    const name = (user.first_name || user.last_name)
      ? `${user.first_name} ${user.last_name}`.trim()
      : user.email;
    if (!window.confirm(`Force logout "${name}" from all devices?`)) {
      return;
    }
    try {
      const response = await api.post(`/users/${user.id}/force-logout`);
      setSuccessMessage(response.data?.message || `${name} has been logged out`);
      await fetchUsers();
      
      // Update selected user to remove active sessions
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser({ ...selectedUser, active_sessions: [] });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to force logout user');
    }
  };

  const handleForceLogoutSession = async (user, sessionId) => {
    if (!window.confirm('Force logout this specific device session?')) {
      return;
    }
    try {
      const response = await api.post(`/users/${user.id}/force-logout/${sessionId}`);
      setSuccessMessage(response.data?.message || 'Session logged out successfully');
      
      // Update selected user locally
      if (selectedUser && selectedUser.id === user.id) {
        const updatedSessions = (selectedUser.active_sessions || []).filter(s => s.session_id !== sessionId);
        setSelectedUser({ ...selectedUser, active_sessions: updatedSessions });
      }
      
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to force logout session');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role.toUpperCase()) {
      case 'CASE_MANAGER':
        return 'error';
      case 'SUPER_ADMIN':
        return 'secondary';
      case 'VENDOR':
        return 'warning';
      case 'QC':
        return 'success';
      case 'CLIENT':
        return 'info';
      case 'ADVOCATE':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getRoleLabel = (user) => {
    const labels = {
      SUPER_ADMIN: 'Super Admin',
      CASE_MANAGER: 'Case Manager',
      VENDOR: 'Business Partner',
      CLIENT: 'Client',
      QC: 'Quality Analyst',
      ADVOCATE: 'Legal Partner',
    };
    return labels[user.role] || user.role;
  };

  // Filter users based on search query, role, and time
  const filteredUsers = users.filter(user => {
    // 1. Search Query Filter (name, email, username)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
      const email = (user.email || '').toLowerCase();
      const username = (user.username || '').toLowerCase();
      const matchesSearch = fullName.includes(q) || email.includes(q) || username.includes(q);
      if (!matchesSearch) return false;
    }

    // 2. Role Filter
    if (roleFilter !== 'ALL') {
      if (roleFilter === 'SUPER_ADMIN') {
        const isSuperAdmin = user.role?.toUpperCase() === 'SUPER_ADMIN' ||
          user.sub_role?.toUpperCase() === 'SUPER_ADMIN';
        if (!isSuperAdmin) return false;
      } else if (roleFilter === 'CASE_MANAGER') {
        const isCaseManager = user.role?.toUpperCase() === 'CASE_MANAGER' &&
          user.sub_role?.toUpperCase() !== 'SUPER_ADMIN' &&
          user.role?.toUpperCase() !== 'SUPER_ADMIN';
        if (!isCaseManager) return false;
      } else {
        if (user.role?.toUpperCase() !== roleFilter) return false;
      }
    }

    // 3. Time Filter (based on date_joined)
    if (timeFilter !== 'ALL') {
      if (!user.date_joined) return false;
      const userDate = new Date(user.date_joined);
      const days = parseInt(timeFilter, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (userDate < cutoff) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <CaseManagerLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </CaseManagerLayout>
    );
  }

  return (
    <CaseManagerLayout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
            User Management
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={handleOpenCreateDialog}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              Add User
            </Button>
            <NotificationBell />
          </Box>
        </Box>

        {error && (
          <AlertMessage severity="error" onClose={() => setError(null)} message={error} open={!!error} />
        )}

        {successMessage && (
          <AlertMessage severity="success" onClose={() => setSuccessMessage(null)} message={successMessage} open={!!successMessage} />
        )}

        {/* Search and Filters Row */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            mb: 3,
            backgroundColor: '#ffffff',
            p: 2,
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Search Bar (Increased width) */}
          <TextField
            size="small"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#64748b' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              width: { xs: '100%', sm: 360, md: 450 },
              maxWidth: 480,
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                '&:hover fieldset': {
                  borderColor: '#667eea',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#667eea',
                },
              },
            }}
          />

          {/* Filters Container on Right Side with Short Width */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', ml: { md: 'auto' }, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
            {/* Role Filter */}
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 }, minWidth: 135 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                label="Role"
                sx={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                }}
              >
                <MenuItem value="ALL">All Roles</MenuItem>
                <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                <MenuItem value="CASE_MANAGER">Case Manager</MenuItem>
                <MenuItem value="VENDOR">Business Partner</MenuItem>
                <MenuItem value="QC">Quality Analyst</MenuItem>
                <MenuItem value="ADVOCATE">Legal Partner</MenuItem>
              </Select>
            </FormControl>

            {/* Time Filter */}
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 }, minWidth: 135 }}>
              <InputLabel>Time</InputLabel>
              <Select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                label="Time"
                sx={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                }}
              >
                <MenuItem value="ALL">All Time</MenuItem>
                <MenuItem value="2">Last 2 days</MenuItem>
                <MenuItem value="5">Last 5 days</MenuItem>
                <MenuItem value="7">Last 7 days</MenuItem>
                <MenuItem value="15">Last 15 days</MenuItem>
                <MenuItem value="30">Last 30 days</MenuItem>
                <MenuItem value="90">Last 90 days</MenuItem>
              </Select>
            </FormControl>

            {(roleFilter !== 'ALL' || timeFilter !== 'ALL' || searchQuery) && (
              <Button 
                variant="text" 
                color="error" 
                onClick={() => { 
                  setRoleFilter('ALL'); 
                  setTimeFilter('ALL'); 
                  setSearchQuery(''); 
                }}
                sx={{ textTransform: 'none', fontWeight: 600, minWidth: '100px' }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '15px' }}>Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '15px' }}>Email</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '15px' }}>Role</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '15px' }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '15px' }}>Active Session Info</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '15px' }}>Custom Permissions</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '15px' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontSize: '15px' }}>
                      No users found matching the selected search and filter criteria.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  hover
                  onClick={() => handleRowClick(user)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell align="center" sx={{ fontSize: '15px', fontWeight: 500 }}>
                    {user.first_name || user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : '-'}
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: '15px' }}>{user.email}</TableCell>
                  <TableCell align="center">
                    {(() => {
                      const style = getRoleStyle(user.role);
                      return (
                        <Chip
                          label={style.label}
                          size="small"
                          sx={{
                            backgroundColor: style.bgColor,
                            color: style.textColor,
                            border: `1px solid ${style.borderColor}`,
                            fontWeight: 700,
                            fontSize: '13px',
                            height: '26px',
                            px: 0.5,
                          }}
                        />
                      );
                    })()}
                  </TableCell>
                  <TableCell align="center">
                    {user.is_active ? (
                      <Chip
                        icon={<CheckCircle sx={{ fontSize: 16 }} />}
                        label="Active"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '13px', height: '26px' }}
                      />
                    ) : (
                      <Chip
                        icon={<Cancel sx={{ fontSize: 16 }} />}
                        label="Inactive"
                        size="small"
                        color="default"
                        variant="outlined"
                        sx={{ fontSize: '13px', height: '26px' }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.is_online ? (
                      <Chip
                        icon={<FiberManualRecord sx={{ fontSize: 10 }} />}
                        label="Online"
                        size="small"
                        sx={{
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          fontWeight: 600,
                          fontSize: '13px',
                          height: '26px',
                          '& .MuiChip-icon': { color: '#16a34a' },
                        }}
                      />
                    ) : (
                      <Chip
                        icon={<FiberManualRecord sx={{ fontSize: 10 }} />}
                        label="Offline"
                        size="small"
                        sx={{
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          fontWeight: 500,
                          fontSize: '13px',
                          height: '26px',
                          '& .MuiChip-icon': { color: '#94a3b8' },
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.permissions && user.permissions.length > 0 ? (
                      <Chip label={`${user.permissions.length} pages`} size="small" color="primary" variant="outlined" sx={{ fontSize: '13px', height: '26px' }} />
                    ) : (
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '15px' }}>Default</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title="Edit User">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(user);
                          }}
                        >
                          <Edit sx={{ fontSize: 19 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete User">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user.id);
                          }}
                        >
                          <Delete sx={{ fontSize: 19 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* User Info Dialog (Read-only) */}
        <Dialog
          open={viewDialogOpen}
          onClose={handleCloseViewDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            },
          }}
        >
          {/* Accent Header Border */}
          <Box sx={{ height: '4px', background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)' }} />

          {/* Dialog Header */}
          <DialogTitle
            sx={{
              p: 2.5,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  bgcolor: '#e0e7ff',
                  color: '#4f46e5',
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  border: '1px solid #c7d2fe',
                  fontWeight: 700,
                  fontSize: '18px',
                }}
              >
                {(selectedViewUser?.first_name || selectedViewUser?.email || 'U').charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                    {selectedViewUser?.first_name || selectedViewUser?.last_name
                      ? `${selectedViewUser.first_name || ''} ${selectedViewUser.last_name || ''}`.trim()
                      : selectedViewUser?.email}
                  </Typography>
                  {selectedViewUser && (() => {
                    const style = getRoleStyle(selectedViewUser.role);
                    return (
                      <Chip
                        label={style.label}
                        size="small"
                        sx={{
                          backgroundColor: style.bgColor,
                          color: style.textColor,
                          border: `1px solid ${style.borderColor}`,
                          fontWeight: 700,
                          fontSize: '11px',
                          height: '22px',
                        }}
                      />
                    );
                  })()}
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block', mt: 0.25 }}>
                  {selectedViewUser?.email}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={handleCloseViewDialog}
              sx={{
                color: '#94a3b8',
                '&:hover': { backgroundColor: '#f1f5f9', color: '#475569' },
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, pt: { xs: 2.5, sm: 3.5 } }}>
            {selectedViewUser && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>

                {/* SECTION 1: Personal Profile */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      color: '#1e293b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontSize: '12px',
                      mb: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1,
                      px: 1.75,
                      backgroundColor: '#f1f5f9',
                      borderRadius: '8px',
                      borderLeft: '4px solid #6366f1',
                    }}
                  >
                    <Person sx={{ fontSize: 18, color: '#6366f1' }} />
                    Profile Information
                  </Typography>

                  <Grid container spacing={2.5}>
                    <Grid item xs={12} sm={6}>
                      <Paper id="field-first-name" variant="outlined" sx={getFieldSx('first_name')}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          First Name
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                          {selectedViewUser.first_name || '-'}
                        </Typography>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Paper id="field-last-name" variant="outlined" sx={getFieldSx('last_name')}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          Last Name
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                          {selectedViewUser.last_name || '-'}
                        </Typography>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: '10px', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          Email Address
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5, wordBreak: 'break-all' }}>
                          {selectedViewUser.email}
                        </Typography>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: '10px', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          Registered / Created Date
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.5 }}>
                          {selectedViewUser.date_joined ? new Date(selectedViewUser.date_joined).toLocaleString() : 'N/A'}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                <Divider sx={{ borderColor: '#e2e8f0' }} />

                {/* SECTION 2: Role & System Access */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      color: '#1e293b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontSize: '12px',
                      mb: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1,
                      px: 1.75,
                      backgroundColor: '#f1f5f9',
                      borderRadius: '8px',
                      borderLeft: '4px solid #6366f1',
                    }}
                  >
                    <SecurityIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                    Role & System Access
                  </Typography>

                  <Grid container spacing={2.5}>
                    <Grid item xs={12} sm={6}>
                      <Paper id="field-role" variant="outlined" sx={getFieldSx('role')}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          Assigned Role
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          {(() => {
                            const style = getRoleStyle(selectedViewUser.role);
                            return (
                              <Chip
                                label={style.label}
                                size="small"
                                sx={{
                                  backgroundColor: style.bgColor,
                                  color: style.textColor,
                                  border: `1px solid ${style.borderColor}`,
                                  fontWeight: 700,
                                  fontSize: '12.5px',
                                  px: 0.5,
                                }}
                              />
                            );
                          })()}
                        </Box>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Paper id="field-device-limit" variant="outlined" sx={getFieldSx('device_limit')}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                            Device Limit
                          </Typography>
                          <Tooltip title="Max simultaneous logged-in devices allowed" arrow placement="top">
                            <HelpOutlineIcon sx={{ fontSize: 14, color: '#64748b', cursor: 'pointer', '&:hover': { color: '#6366f1' } }} />
                          </Tooltip>
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                          {selectedViewUser.device_limit || 1} simultaneous device(s)
                        </Typography>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Paper
                        id="field-status"
                        variant="outlined"
                        sx={getFieldSx(
                          'status',
                          selectedViewUser.is_active ? '#f0fdf4' : '#f8fafc',
                          selectedViewUser.is_active ? '#86efac' : '#cbd5e1'
                        )}
                      >
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          Account Status
                        </Typography>
                        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={selectedViewUser.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            color={selectedViewUser.is_active ? 'success' : 'default'}
                            sx={{ fontWeight: 700 }}
                          />
                          <Typography variant="caption" sx={{ color: '#475569' }}>
                            {selectedViewUser.is_active ? 'Can sign in to portal' : 'Blocked from login'}
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: '10px', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                          Session Activity
                        </Typography>
                        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {selectedViewUser.is_online ? (
                            <Chip
                              icon={<FiberManualRecord sx={{ fontSize: 10 }} />}
                              label="Online Now"
                              size="small"
                              sx={{
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                fontWeight: 700,
                                '& .MuiChip-icon': { color: '#16a34a' },
                              }}
                            />
                          ) : (
                            <Chip
                              icon={<FiberManualRecord sx={{ fontSize: 10 }} />}
                              label="Offline"
                              size="small"
                              sx={{
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontWeight: 600,
                                '& .MuiChip-icon': { color: '#94a3b8' },
                              }}
                            />
                          )}
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                <Divider sx={{ borderColor: '#e2e8f0' }} />

                {/* SECTION 3: Password Information */}
                <Box id="field-password">
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      color: '#1e293b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontSize: '12px',
                      mb: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1,
                      px: 1.75,
                      backgroundColor: '#f1f5f9',
                      borderRadius: '8px',
                      borderLeft: '4px solid #6366f1',
                    }}
                  >
                    <KeyIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                    Password Information
                  </Typography>

                  <Paper variant="outlined" sx={getFieldSx('password')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                      Current Password Details
                    </Typography>
                    {selectedViewUser.plain_password ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '15px',
                            letterSpacing: showViewPassword ? '0.05em' : '0.2em',
                            color: '#1e1b4b',
                            backgroundColor: '#e0e7ff',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '6px',
                            border: '1px solid #c7d2fe',
                          }}
                        >
                          {showViewPassword ? selectedViewUser.plain_password : '••••••••••••'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => setShowViewPassword((prev) => !prev)}
                          sx={{ color: '#4f46e5' }}
                        >
                          {showViewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic', mt: 0.5 }}>
                        Password was set externally or encrypted via hash. Reset or edit password in Super Admin to store plain view.
                      </Typography>
                    )}
                  </Paper>
                </Box>

                {/* SECTION 4: Active Session Details */}
                {selectedViewUser?.active_sessions && selectedViewUser.active_sessions.length > 0 && (
                  <>
                    <Divider sx={{ borderColor: '#e2e8f0' }} />
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          color: '#1e293b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontSize: '12px',
                          mb: 2.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          p: 1,
                          px: 1.75,
                          backgroundColor: '#f1f5f9',
                          borderRadius: '8px',
                          borderLeft: '4px solid #6366f1',
                        }}
                      >
                        <ComputerIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                        Currently Logged In Devices ({selectedViewUser.active_sessions.length}/{selectedViewUser.device_limit || 1})
                      </Typography>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {selectedViewUser.active_sessions.map((session, idx) => (
                          <Paper
                            key={idx}
                            variant="outlined"
                            sx={{
                              p: 2.5,
                              borderRadius: '12px',
                              backgroundColor: '#ffffff',
                              borderColor: '#cbd5e1',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                <Avatar sx={{ bgcolor: '#e0e7ff', color: '#4f46e5', width: 40, height: 40, borderRadius: '10px', mt: 0.2 }}>
                                  <ComputerIcon sx={{ fontSize: 22 }} />
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                                    IP Address: <span style={{ fontFamily: 'monospace', color: '#4338ca', fontWeight: 700 }}>{session.ip_address || 'N/A'}</span>
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#475569', display: 'block', mt: 0.5, maxWidth: 450, fontSize: '13px' }}>
                                    {session.device_info || 'Unknown Device'}
                                  </Typography>
                                </Box>
                              </Box>

                              <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 500 }}>
                                  Started: <strong>{new Date(session.token_created_at).toLocaleString()}</strong>
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 500 }}>
                                  Last Active: <strong>{session.last_used_at ? new Date(session.last_used_at).toLocaleString() : 'N/A'}</strong>
                                </Typography>
                              </Box>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  </>
                )}

                {/* SECTION 5: Custom Page Permissions */}
                {selectedViewUser.role === 'CASE_MANAGER' && (
                  <>
                    <Divider sx={{ borderColor: '#e2e8f0' }} />
                    <Box id="custom-permissions-section">
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          color: '#1e293b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontSize: '12px',
                          mb: 0.75,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          p: 1,
                          px: 1.75,
                          backgroundColor: '#f1f5f9',
                          borderRadius: '8px',
                          borderLeft: '4px solid #6366f1',
                        }}
                      >
                        <ShieldIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                        Custom Page Permissions
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2.5, fontSize: '13px', color: '#475569', fontWeight: 500, px: 0.5 }}>
                        Configured permissions for this case manager account.
                      </Typography>

                      <Grid container spacing={2}>
                        {ADMIN_PAGES.map((page) => {
                          const isGranted = selectedViewUser.permissions?.includes(page.path);
                          const isModified = (() => {
                            if (!highlightPermissions || !highlightDesc) return false;
                            const descLower = highlightDesc.toLowerCase();
                            const labelLower = page.label.toLowerCase();
                            const pathLower = page.path.toLowerCase();
                            if (descLower.includes(labelLower) || descLower.includes(pathLower)) {
                              return true;
                            }
                            if (labelLower.includes('legal') && descLower.includes('legal')) return true;
                            if (labelLower.includes('ai') && descLower.includes('ai')) return true;
                            if (labelLower.includes('audit') && descLower.includes('audit')) return true;
                            return false;
                          })();
                          return (
                            <Grid item xs={12} sm={6} key={page.path}>
                              <Paper
                                variant="outlined"
                                sx={{
                                  height: '52px',
                                  px: 2.5,
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  boxSizing: 'border-box',
                                  backgroundColor: isModified ? '#ffedd5' : (isGranted ? '#eff6ff' : '#ffffff'),
                                  borderColor: isModified ? '#ea580c' : (isGranted ? '#93c5fd' : '#e2e8f0'),
                                  borderWidth: '1.5px',
                                  borderStyle: 'solid',
                                  boxShadow: isModified
                                    ? '0 0 14px rgba(234,88,12,0.45)'
                                    : (isGranted ? '0 2px 4px rgba(37,99,235,0.08)' : 'none'),
                                  transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                                }}
                              >
                                <Box sx={{ flex: 1, minWidth: 0, mr: 1.5 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: isGranted || isModified ? 700 : 600,
                                      color: isModified ? '#c2410c' : (isGranted ? '#1e40af' : '#334155'),
                                      fontSize: '14px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {page.label}
                                  </Typography>
                                </Box>
                                <Chip
                                  label={isGranted ? 'Granted' : 'Default'}
                                  size="small"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: '11.5px',
                                    height: '24px',
                                    px: 1,
                                    backgroundColor: isGranted ? '#2563eb' : '#f1f5f9',
                                    color: isGranted ? '#ffffff' : '#64748b',
                                    flexShrink: 0,
                                  }}
                                />
                              </Paper>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  </>
                )}

              </Box>
            )}
          </DialogContent>

          {/* Footer Actions */}
          <DialogActions sx={{ p: 2.5, px: 3, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Edit />}
              onClick={() => {
                const u = selectedViewUser;
                handleCloseViewDialog();
                if (u) handleEditClick(u);
              }}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
            >
              Edit User Account
            </Button>

            <Button
              onClick={handleCloseViewDialog}
              variant="contained"
              sx={{
                borderRadius: '10px',
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: '#475569',
                '&:hover': { backgroundColor: '#334155' },
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog
          open={editDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            },
          }}
        >
          {/* Accent Header Border */}
          <Box sx={{ height: '4px', background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)' }} />

          {/* Dialog Header */}
          <DialogTitle
            sx={{
              p: 2.5,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  bgcolor: '#eef2ff',
                  color: '#6366f1',
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  border: '1px solid #c7d2fe',
                }}
              >
                <ManageAccounts />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                  Edit User Account
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  {selectedUser?.email}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{
                color: '#94a3b8',
                '&:hover': { backgroundColor: '#f1f5f9', color: '#475569' },
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, pt: { xs: 2.5, sm: 3.5 } }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>

              {/* SECTION 1: Personal Profile */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#1e293b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '12px',
                    mb: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1,
                    px: 1.75,
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px',
                    borderLeft: '4px solid #6366f1',
                  }}
                >
                  <Person sx={{ fontSize: 18, color: '#6366f1' }} />
                  Profile Information
                </Typography>

                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={3.5}>
                    <TextField
                      fullWidth
                      label="First Name"
                      placeholder="Enter first name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Badge sx={{ color: '#64748b', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          color: '#0f172a',
                          fontWeight: 500,
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#6366f1' },
                          '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={3.5}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      placeholder="Enter last name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Badge sx={{ color: '#64748b', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          color: '#0f172a',
                          fontWeight: 500,
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#6366f1' },
                          '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      placeholder="user@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon sx={{ color: '#64748b', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          color: '#0f172a',
                          fontWeight: 500,
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#6366f1' },
                          '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ borderColor: '#e2e8f0' }} />

              {/* SECTION 2: Role & System Access */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#1e293b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '12px',
                    mb: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1,
                    px: 1.75,
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px',
                    borderLeft: '4px solid #6366f1',
                  }}
                >
                  <SecurityIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                  Role & System Access
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
                  <FormControl sx={{ width: '220px', '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 } }}>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={formData.role}
                      label="Role"
                      onChange={(e) => handleInputChange('role', e.target.value)}
                      sx={{
                        borderRadius: '10px',
                        color: '#0f172a',
                        fontWeight: 600,
                        backgroundColor: '#ffffff',
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                      }}
                    >
                      <MenuItem value="CASE_MANAGER">Case Manager</MenuItem>
                      <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                      <MenuItem value="VENDOR">Business Partner</MenuItem>
                      <MenuItem value="QC">Quality Analyst</MenuItem>
                      <MenuItem value="ADVOCATE">Legal Partner</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label={
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        Device Limit
                        <Tooltip title="Max simultaneous logged-in devices allowed" arrow placement="top">
                          <HelpOutlineIcon sx={{ fontSize: 16, color: '#64748b', cursor: 'pointer', '&:hover': { color: '#6366f1' } }} />
                        </Tooltip>
                      </Box>
                    }
                    type="number"
                    InputProps={{ inputProps: { min: 1 } }}
                    value={formData.device_limit}
                    onChange={(e) => handleInputChange('device_limit', e.target.value)}
                    sx={{
                      width: '120px',
                      '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600, fontSize: '15px' },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '10px',
                        color: '#0f172a',
                        fontWeight: 600,
                        backgroundColor: '#ffffff',
                        '&:hover fieldset': { borderColor: '#6366f1' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                      },
                    }}
                  />

                  <Paper
                    variant="outlined"
                    sx={{
                      px: 2,
                      py: 1,
                      minHeight: '56px',
                      height: '56px',
                      borderRadius: '10px',
                      backgroundColor: formData.is_active ? '#f0fdf4' : '#f8fafc',
                      borderColor: formData.is_active ? '#86efac' : '#cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                      Account Status
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={formData.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={formData.is_active ? 'success' : 'default'}
                        sx={{ fontWeight: 700, px: 0.5, height: '24px', fontSize: '12px' }}
                      />
                      <Switch
                        checked={formData.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                        color="success"
                        size="small"
                        sx={{ m: 0 }}
                      />
                    </Box>
                  </Paper>
                </Box>
              </Box>

              <Divider sx={{ borderColor: '#e2e8f0' }} />

              {/* SECTION 3: Password Management */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#1e293b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '12px',
                    mb: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1,
                    px: 1.75,
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px',
                    borderLeft: '4px solid #6366f1',
                  }}
                >
                  <KeyIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                  Password Management
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* Row 1: Current Password */}
                  <TextField
                    label="Current Password"
                    type={showEditPassword ? 'text' : 'password'}
                    value={formData.password}
                    disabled
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: '#475569', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showEditPassword ? 'Hide current password' : 'Show current password'}
                            edge="end"
                            onClick={() => setShowEditPassword((value) => !value)}
                          >
                            {showEditPassword ? <VisibilityOff sx={{ color: '#475569' }} /> : <Visibility sx={{ color: '#475569' }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      width: '280px',
                      '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '10px',
                        backgroundColor: '#f8fafc',
                        '& .MuiInputBase-input.Mui-disabled': {
                          color: '#0f172a',
                          WebkitTextFillColor: '#0f172a',
                          fontWeight: 600,
                        },
                      },
                    }}
                  />

                  {/* Row 2: New Password & Confirm New Password */}
                  <Box sx={{ display: 'flex', gap: 2.5 }}>
                    <TextField
                      label="New Password"
                      placeholder="Enter new password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={formData.new_password}
                      onChange={(e) => handleInputChange('new_password', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock sx={{ color: '#64748b', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                              edge="end"
                              onClick={() => setShowNewPassword((value) => !value)}
                            >
                              {showNewPassword ? <VisibilityOff sx={{ color: '#64748b' }} /> : <Visibility sx={{ color: '#64748b' }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        width: '280px',
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          color: '#0f172a',
                          fontWeight: 500,
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#6366f1' },
                          '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                        },
                      }}
                    />

                    <TextField
                      label="Confirm New Password"
                      placeholder="Confirm new password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirm_new_password}
                      onChange={(e) => handleInputChange('confirm_new_password', e.target.value)}
                      error={Boolean(
                        formData.new_password &&
                        formData.confirm_new_password &&
                        formData.new_password !== formData.confirm_new_password
                      )}
                      helperText={
                        formData.new_password &&
                          formData.confirm_new_password &&
                          formData.new_password !== formData.confirm_new_password
                          ? 'Passwords do not match'
                          : undefined
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock sx={{ color: '#64748b', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                              edge="end"
                              onClick={() => setShowConfirmPassword((value) => !value)}
                            >
                              {showConfirmPassword ? <VisibilityOff sx={{ color: '#64748b' }} /> : <Visibility sx={{ color: '#64748b' }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        width: '280px',
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiFormHelperText-root': { color: '#ef4444', fontWeight: 500, fontSize: '12px' },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          color: '#0f172a',
                          fontWeight: 500,
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#6366f1' },
                          '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Box>

              {/* SECTION 4: Active Session Info */}
              {selectedUser?.active_sessions && selectedUser.active_sessions.length > 0 && (
                <>
                  <Divider sx={{ borderColor: '#e2e8f0' }} />
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          color: '#1e293b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          p: 1,
                          px: 1.75,
                          backgroundColor: '#f1f5f9',
                          borderRadius: '8px',
                          borderLeft: '4px solid #6366f1',
                        }}
                      >
                        <ComputerIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                        Currently Logged In Devices ({selectedUser.active_sessions.length}/{formData.device_limit || 1})
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        startIcon={<LogoutIcon />}
                        onClick={() => handleForceLogout(selectedUser)}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, px: 2 }}
                      >
                        Force Logout All
                      </Button>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {selectedUser.active_sessions.map((session, idx) => (
                        <Paper
                          key={idx}
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            borderRadius: '12px',
                            backgroundColor: '#ffffff',
                            borderColor: '#cbd5e1',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: '#94a3b8' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                              <Avatar sx={{ bgcolor: '#e0e7ff', color: '#4f46e5', width: 40, height: 40, borderRadius: '10px', mt: 0.2 }}>
                                <ComputerIcon sx={{ fontSize: 22 }} />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                                  IP Address: <span style={{ fontFamily: 'monospace', color: '#4338ca', fontWeight: 700 }}>{session.ip_address || 'N/A'}</span>
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#475569', display: 'block', mt: 0.5, maxWidth: 450, fontSize: '13px' }}>
                                  {session.device_info || 'Unknown Device'}
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 0.5 }}>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 500 }}>
                                Started: <strong>{new Date(session.token_created_at).toLocaleString()}</strong>
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 500 }}>
                                Last Active: <strong>{session.last_used_at ? new Date(session.last_used_at).toLocaleString() : 'N/A'}</strong>
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                variant="text"
                                onClick={() => handleForceLogoutSession(selectedUser, session.session_id)}
                                sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontWeight: 700, mt: 0.5 }}
                              >
                                Logout Device
                              </Button>
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                </>
              )}

              {/* SECTION 5: Custom Page Permissions */}
              {formData.role === 'CASE_MANAGER' && (
                <>
                  <Divider sx={{ borderColor: '#e2e8f0' }} />
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        color: '#1e293b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontSize: '12px',
                        mb: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1,
                        px: 1.75,
                        backgroundColor: '#f1f5f9',
                        borderRadius: '8px',
                        borderLeft: '4px solid #6366f1',
                      }}
                    >
                      <ShieldIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                      Custom Page Permissions
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2.5, fontSize: '13px', color: '#475569', fontWeight: 500, px: 0.5 }}>
                      Toggle individual pages for this case manager user.
                    </Typography>

                    <Grid container spacing={2}>
                      {ADMIN_PAGES.map((page) => {
                        const isGranted = formData.permissions?.includes(page.path);
                        return (
                          <Grid item xs={12} sm={6} key={page.path}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 2,
                                px: 2.5,
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backgroundColor: isGranted ? '#eff6ff' : '#ffffff',
                                borderColor: isGranted ? '#60a5fa' : '#cbd5e1',
                                boxShadow: isGranted ? '0 2px 6px rgba(37,99,235,0.1)' : 'none',
                                '&:hover': {
                                  borderColor: isGranted ? '#2563eb' : '#94a3b8',
                                  transform: 'translateY(-1px)',
                                },
                              }}
                              onClick={() => handlePermissionToggle(page.path)}
                            >
                              <Box sx={{ flex: 1, minWidth: 0, mr: 1.5 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: isGranted ? 700 : 600,
                                    color: isGranted ? '#1e40af' : '#334155',
                                    fontSize: '14px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {page.label}
                                </Typography>
                              </Box>
                              <Switch
                                checked={isGranted || false}
                                size="small"
                                color="primary"
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handlePermissionToggle(page.path)}
                                sx={{ flexShrink: 0 }}
                              />
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                </>
              )}

            </Box>
          </DialogContent>

          {/* Footer Actions */}
          <DialogActions sx={{ p: 2.5, px: 3, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Button
              onClick={handleCloseDialog}
              sx={{
                borderRadius: '10px',
                px: 2.5,
                color: '#64748b',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#e2e8f0' },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveUser}
              disabled={saveLoading}
              sx={{
                borderRadius: '10px',
                px: 3.5,
                py: 1,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                },
              }}
            >
              {saveLoading ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={handleCloseCreateDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }
          }}
        >
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              py: 3,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <PersonAdd sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Create New User
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                Add a new user to the system with role-based access
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 4, pb: 3, px: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Account Information Section */}
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{
                    mb: 2.5,
                    color: '#667eea',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <AccountCircle sx={{ fontSize: 20 }} />
                  Account Information
                </Typography>
                <Grid container spacing={2.5}>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      placeholder="user@example.com"
                      value={createFormData.email}
                      onChange={(e) => handleCreateInputChange('email', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon sx={{ color: '#667eea' }} />
                          </InputAdornment>
                        ),
                      }}
                      helperText="Must be a valid and unique email"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#667eea',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#667eea',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Personal Information Section */}
              <Box>
                <Divider sx={{ mb: 3 }} />
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{
                    mb: 2.5,
                    color: '#667eea',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Badge sx={{ fontSize: 20 }} />
                  Personal Information
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="First Name"
                      placeholder="Enter first name"
                      value={createFormData.first_name}
                      onChange={(e) => handleCreateInputChange('first_name', e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#667eea',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#667eea',
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      placeholder="Enter last name"
                      value={createFormData.last_name}
                      onChange={(e) => handleCreateInputChange('last_name', e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#667eea',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#667eea',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Security & Access Section */}
              <Box>
                <Divider sx={{ mb: 3 }} />
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{
                    mb: 2.5,
                    color: '#667eea',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Lock sx={{ fontSize: 20 }} />
                  Security & Access
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Password"
                      type={showCreatePassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={createFormData.password}
                      onChange={(e) => handleCreateInputChange('password', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock sx={{ color: '#667eea' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                              edge="end"
                              onClick={() => setShowCreatePassword((value) => !value)}
                            >
                              {showCreatePassword ? <VisibilityOff sx={{ color: '#667eea' }} /> : <Visibility sx={{ color: '#667eea' }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      helperText="Minimum 8 characters required"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#667eea',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#667eea',
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Confirm Password"
                      type={showCreateConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={createFormData.confirm_password}
                      onChange={(e) => handleCreateInputChange('confirm_password', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock sx={{ color: '#667eea' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showCreateConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                              edge="end"
                              onClick={() => setShowCreateConfirmPassword((value) => !value)}
                            >
                              {showCreateConfirmPassword ? <VisibilityOff sx={{ color: '#667eea' }} /> : <Visibility sx={{ color: '#667eea' }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      helperText="Must match the password"
                      error={createFormData.confirm_password && createFormData.password !== createFormData.confirm_password}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#667eea',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#667eea',
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#667eea',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#667eea',
                        },
                      }}
                    >
                      <InputLabel>User Role</InputLabel>
                      <Select
                        value={createFormData.role}
                        label="User Role"
                        onChange={(e) => handleCreateInputChange('role', e.target.value)}
                      >
                        <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                        <MenuItem value="CASE_MANAGER">Case Manager</MenuItem>
                        <MenuItem value="VENDOR">Business Partner</MenuItem>
                        <MenuItem value="QC">Quality Analyst</MenuItem>
                        <MenuItem value="ADVOCATE">Legal Partner</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2.5,
              backgroundColor: '#f8f9fa',
              gap: 1.5,
            }}
          >
            <Button
              onClick={handleCloseCreateDialog}
              sx={{
                color: '#666',
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 500,
                px: 3,
                '&:hover': {
                  backgroundColor: '#e9ecef',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateUser}
              disabled={createLoading}
              startIcon={createLoading ? <CircularProgress size={18} color="inherit" /> : <PersonAdd />}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 600,
                px: 4,
                py: 1,
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)',
                },
                '&:disabled': {
                  background: '#ccc',
                },
              }}
            >
              {createLoading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </CaseManagerLayout>
  );
};

export default UsersPage;
