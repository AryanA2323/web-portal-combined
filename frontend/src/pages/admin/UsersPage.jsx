import { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// All available admin pages for permission toggles
const ADMIN_PAGES = [
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/cases', label: 'Cases' },
  { path: '/admin/email-intake', label: 'Email Intake' },
  { path: '/admin/vendors', label: 'Vendors' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/ai-brief', label: 'AI Brief Review' },
  { path: '/admin/legal-review', label: 'Legal Review' },
  { path: '/admin/process-document', label: 'Process Document' },
  { path: '/admin/reports', label: 'Reports' },
  { path: '/admin/audit-logs', label: 'Audit Logs' },
  { path: '/admin/settings', label: 'Settings' },
];

const UsersPage = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Create user dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    username: '',
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
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateFormData({
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      first_name: '',
      last_name: '',
      role: 'VENDOR',
      sub_role: '',
    });
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreateFormData({
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      first_name: '',
      last_name: '',
      role: 'VENDOR',
      sub_role: '',
    });
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
      if (!createFormData.username.trim()) {
        setError('Username is required');
        return;
      }
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
        username: createFormData.username.trim(),
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
      permissions: user.permissions || [],
    });
    setEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setSelectedUser(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      role: 'VENDOR',
      is_active: true,
      permissions: [],
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // If role is changed to non-ADMIN, clear permissions
      if (field === 'role' && value !== 'ADMIN') {
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
      
      // Prepare payload with only the necessary fields
      const payload = {
        first_name: formData.first_name || '',
        last_name: formData.last_name || '',
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active,
      };
      
      // Only include permissions for ADMIN users
      if (formData.role === 'ADMIN') {
        payload.permissions = Array.isArray(formData.permissions) ? formData.permissions : [];
      }
      
      console.log('Sending payload:', payload);
      
      const response = await api.put(`/users/${selectedUser.id}`, payload);
      console.log('Update response:', response.data);
      
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

  const getRoleBadgeColor = (role) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return 'error';
      case 'SUPER_ADMIN':
        return 'secondary';
      case 'VENDOR':
        return 'warning';
      case 'LAWYER':
        return 'success';
      case 'CLIENT':
        return 'info';
      default:
        return 'default';
    }
  };

  const getRoleLabel = (user) => {
    // Return role directly (no more sub_role conversion)
    return user.role;
  };

  const getSubRoleBadgeColor = (subRole) => {
    switch (subRole?.toUpperCase()) {
      case 'SUPER_ADMIN':
        return 'error';
      case 'CASE_HANDLER':
        return 'primary';
      case 'REPORT_MANAGER':
        return 'secondary';
      case 'LOG_MANAGER':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={600}>
            User Management
          </Typography>
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
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
              <TableRow>
                <TableCell><strong>Username</strong></TableCell>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Custom Permissions</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    {user.first_name || user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : '-'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={getRoleLabel(user)}
                      size="small"
                      color={getRoleBadgeColor(getRoleLabel(user))}
                    />
                  </TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <Chip
                        icon={<CheckCircle />}
                        label="Active"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<Cancel />}
                        label="Inactive"
                        size="small"
                        color="default"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {user.permissions && user.permissions.length > 0 ? (
                      <Chip label={`${user.permissions.length} pages`} size="small" color="primary" variant="outlined" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">Default</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit User">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEditClick(user)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete User">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            Edit User: {selectedUser?.username}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={formData.role}
                      label="Role"
                      onChange={(e) => handleInputChange('role', e.target.value)}
                    >
                      <MenuItem value="ADMIN">Admin</MenuItem>
                      <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                      <MenuItem value="VENDOR">Vendor</MenuItem>
                      <MenuItem value="LAWYER">Lawyer</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      />
                    }
                    label="Account Active"
                  />
                </Grid>

                {formData.role === 'ADMIN' && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                        Custom Page Permissions
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Toggle individual pages for this admin user. Select the pages they can access.
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Grid container spacing={1}>
                        {ADMIN_PAGES.map((page) => (
                          <Grid item xs={12} sm={6} md={4} key={page.path}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                backgroundColor: formData.permissions?.includes(page.path)
                                  ? '#e3f2fd'
                                  : 'transparent',
                                borderColor: formData.permissions?.includes(page.path)
                                  ? '#2196f3'
                                  : '#e0e0e0',
                                '&:hover': {
                                  backgroundColor: formData.permissions?.includes(page.path)
                                    ? '#bbdefb'
                                    : '#f5f5f5',
                                },
                              }}
                              onClick={() => handlePermissionToggle(page.path)}
                            >
                              <Typography variant="body2">{page.label}</Typography>
                              <Switch
                                checked={formData.permissions?.includes(page.path) || false}
                                size="small"
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handlePermissionToggle(page.path)}
                              />
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSaveUser}
              disabled={saveLoading}
            >
              {saveLoading ? <CircularProgress size={20} /> : 'Save Changes'}
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
                      label="Username"
                      placeholder="Enter unique username"
                      value={createFormData.username}
                      onChange={(e) => handleCreateInputChange('username', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person sx={{ color: '#667eea' }} />
                          </InputAdornment>
                        ),
                      }}
                      helperText="3-150 characters, must be unique"
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
                      type="password"
                      placeholder="••••••••"
                      value={createFormData.password}
                      onChange={(e) => handleCreateInputChange('password', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock sx={{ color: '#667eea' }} />
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
                      type="password"
                      placeholder="••••••••"
                      value={createFormData.confirm_password}
                      onChange={(e) => handleCreateInputChange('confirm_password', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock sx={{ color: '#667eea' }} />
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
                        <MenuItem value="SUPER_ADMIN">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label="Super Admin" size="small" color="secondary" />
                            <Typography variant="body2">User & vendor management</Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="ADMIN">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label="Admin" size="small" color="error" />
                            <Typography variant="body2">Full system access</Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="VENDOR">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label="Vendor" size="small" color="warning" />
                            <Typography variant="body2">Vendor portal access</Typography>
                          </Box>
                        </MenuItem>
                        <MenuItem value="LAWYER">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label="Lawyer" size="small" color="success" />
                            <Typography variant="body2">Legal case management</Typography>
                          </Box>
                        </MenuItem>
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
    </AdminLayout>
  );
};

export default UsersPage;
