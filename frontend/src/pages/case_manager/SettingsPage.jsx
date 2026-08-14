import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  InputAdornment,
  IconButton,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Badge,
  CalendarToday,
  VerifiedUser,
  History,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import { NotificationBell } from '../../components/case_manager';
import AlertMessage from '../../components/common/AlertMessage';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const SettingSection = ({ icon: Icon, iconColor = '#4f46e5', title, subtitle, children }) => (
  <Paper
    elevation={0}
    sx={{
      mb: 3,
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      backgroundColor: '#ffffff',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03), 0 6px 16px rgba(15, 23, 42, 0.02)',
      transition: 'box-shadow 0.2s ease-in-out',
      '&:hover': {
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06), 0 10px 24px rgba(15, 23, 42, 0.04)',
      },
    }}
  >
    <Box
      sx={{
        px: { xs: 2.5, md: 3.5 },
        py: 2.5,
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          backgroundColor: `${iconColor}15`,
          borderRadius: '12px',
          p: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${iconColor}25`,
        }}
      >
        <Icon sx={{ color: iconColor, fontSize: 24 }} />
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', lineHeight: 1.2 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem', mt: 0.25 }}>
          {subtitle}
        </Typography>
      </Box>
    </Box>
    <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>{children}</Box>
  </Paper>
);

const SettingsPage = () => {
  const { user, refreshUser } = useAuth();

  // Profile Form State
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Global Alert Messages
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Activity Log State
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsOffset, setLogsOffset] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);

  // Initialize form with current user data
  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  // Fetch activity logs
  const fetchActivityLogs = async (offset = 0, append = false) => {
    try {
      setLogsLoading(true);
      const response = await api.get(`/auth/activity-log?limit=20&offset=${offset}`);
      const logs = response.data || [];
      if (append) {
        setActivityLogs(prev => [...prev, ...logs]);
      } else {
        setActivityLogs(logs);
      }
      setHasMoreLogs(logs.length >= 20);
      setLogsOffset(offset + logs.length);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  // Save Profile Changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileData.email.trim()) {
      setError('Email address cannot be empty');
      return;
    }
    try {
      setProfileLoading(true);
      setError(null);
      await api.put('/auth/profile', {
        first_name: profileData.first_name.trim(),
        last_name: profileData.last_name.trim(),
        email: profileData.email.trim(),
      });
      await refreshUser();
      setSuccess('Profile details updated successfully');
      fetchActivityLogs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile details');
    } finally {
      setProfileLoading(false);
    }
  };

  // Change Password Submit
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordData.current_password) {
      setError('Please enter your current password');
      return;
    }
    if (!passwordData.new_password) {
      setError('Please enter a new password');
      return;
    }
    if (passwordData.new_password.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    if (passwordData.current_password === passwordData.new_password) {
      setError('New password must be different from current password');
      return;
    }

    try {
      setPasswordLoading(true);
      setError(null);
      const response = await api.post('/auth/password/change', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password,
      });
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      // If the backend returned a new token, update it in storage
      if (response?.data?.token) {
        const { authStorage } = await import('../../utils/authStorage');
        authStorage.setItem('accessToken', response.data.token);
      }
      setSuccess('Password updated successfully');
      // Refresh activity logs to show the password change
      fetchActivityLogs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password. Verify your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Format user role label
  const roleLabel = user?.role === 'CASE_MANAGER' ? 'Case Manager' : user?.role || 'Case Manager';
  const subRoleLabel = user?.sub_role ? user.sub_role.replace('_', ' ') : null;
  const joinedDate = user?.date_joined ? new Date(user.date_joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  return (
    <CaseManagerLayout disablePadding>
      {/* Top Section Banner - Full Width Page Header */}
      <Box
        sx={{
          minHeight: 110,
          py: 1.75,
          mx: { xs: 1.5, md: 2.5 },
          px: { xs: 2, md: 3 },
          borderRadius: '0 0 16px 16px',
          boxSizing: 'border-box',
          background: 'linear-gradient(120deg, #f8fafc 0%, #edf2f7 35%, #e2e8f0 70%, #e0e7ff 100%)',
          boxShadow: '0 4px 16px rgba(148, 163, 184, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderTop: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(14, 165, 233, 0.15) 0%, transparent 40%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Left Side: Header Title & Icon */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              p: 1.2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            <SettingsIcon sx={{ color: '#4f46e5', fontSize: 26 }} />
          </Box>

          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.4rem', md: '1.75rem' },
                letterSpacing: '-0.5px',
                color: '#0f172a',
                lineHeight: 1.1,
              }}
            >
              Account Settings
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: '#475569',
                fontSize: { xs: '0.75rem', md: '0.85rem' },
                fontWeight: 500,
                mt: 0.25,
              }}
            >
              Manage your personal profile details and security password credentials
            </Typography>
          </Box>
        </Box>

        {/* Right Side: Notification Bell */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center' }}>
          <NotificationBell />
        </Box>
      </Box>

      {/* Main Content Area - Full Width Container matching other Case Manager pages */}
      <Box sx={{ px: { xs: 1.5, md: 2.5 }, py: 3, width: '100%', boxSizing: 'border-box' }}>
        {/* Global Feedback Alerts */}
        <AlertMessage severity="error" onClose={() => setError(null)} message={error} open={!!error} />
        <AlertMessage severity="success" onClose={() => setSuccess(null)} message={success} open={!!success} />

        {/* SECTION 1: Personal Profile */}
        <SettingSection
          icon={Person}
          iconColor="#4f46e5"
          title="Personal Profile Information"
          subtitle="Update your personal identification details and primary contact email"
        >
          <Box component="form" onSubmit={handleSaveProfile}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                  First Name
                </Typography>
                <TextField
                  fullWidth
                  value={profileData.first_name}
                  onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                  placeholder="Enter first name"
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person sx={{ color: '#94a3b8', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                  Last Name
                </Typography>
                <TextField
                  fullWidth
                  value={profileData.last_name}
                  onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                  placeholder="Enter last name"
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person sx={{ color: '#94a3b8', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                  Email Address (Login & Notifications)
                </Typography>
                <TextField
                  fullWidth
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  placeholder="user@example.com"
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email sx={{ color: '#94a3b8', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>

              {/* Account Metadata Cards */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Badge sx={{ color: '#64748b' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                      Role & Permissions Scope:
                    </Typography>
                    <Chip
                      label={roleLabel}
                      size="small"
                      sx={{ backgroundColor: '#4f46e5', color: '#fff', fontWeight: 600, borderRadius: '8px' }}
                    />
                    {subRoleLabel && (
                      <Chip
                        label={subRoleLabel}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#6366f1', color: '#4338ca', fontWeight: 600, borderRadius: '8px' }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarToday sx={{ color: '#64748b', fontSize: 16 }} />
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Member Since: <strong>{joinedDate}</strong>
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <VerifiedUser sx={{ color: '#16a34a', fontSize: 16 }} />
                      <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700 }}>
                        Account Active
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, pt: 2, borderTop: '1px solid #f1f5f9' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={profileLoading}
                sx={{
                  backgroundColor: '#4f46e5',
                  textTransform: 'none',
                  px: 3.5,
                  py: 1,
                  fontWeight: 600,
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                  '&:hover': { backgroundColor: '#4338ca' },
                }}
              >
                {profileLoading ? <CircularProgress size={20} color="inherit" /> : 'Save Profile Changes'}
              </Button>
            </Box>
          </Box>
        </SettingSection>

        {/* SECTION 2: Change Password */}
        <SettingSection
          icon={Lock}
          iconColor="#0284c7"
          title="Password & Security Credentials"
          subtitle="Update your account password to ensure continuous security"
        >
          <Box component="form" onSubmit={handleChangePassword}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                  Current Password
                </Typography>
                <TextField
                  fullWidth
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  placeholder="Enter current password"
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowCurrentPassword(!showCurrentPassword)} edge="end">
                          {showCurrentPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                  New Password
                </Typography>
                <TextField
                  fullWidth
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  placeholder="Min. 8 characters"
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end">
                          {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                  Confirm New Password
                </Typography>
                <TextField
                  fullWidth
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  placeholder="Re-type new password"
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                          {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, pt: 2, borderTop: '1px solid #f1f5f9' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={passwordLoading}
                sx={{
                  backgroundColor: '#0284c7',
                  textTransform: 'none',
                  px: 3.5,
                  py: 1,
                  fontWeight: 600,
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                  '&:hover': { backgroundColor: '#0369a1' },
                }}
              >
                {passwordLoading ? <CircularProgress size={20} color="inherit" /> : 'Update Password'}
              </Button>
            </Box>
          </Box>
        </SettingSection>

        {/* SECTION 3: Account Activity Log */}
        <SettingSection
          icon={History}
          iconColor="#7c3aed"
          title="Account Activity Log"
          subtitle="Recent changes and login activity for your account"
        >
          {logsLoading && activityLogs.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : activityLogs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <History sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>No activity recorded yet</Typography>
            </Box>
          ) : (
            <>
              <TableContainer sx={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>Action</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>IP Address</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>Date & Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Chip
                            label={log.action_display || log.action}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              backgroundColor:
                                log.action === 'PASSWORD_CHANGE' ? '#fef3c7'
                                : log.action === 'PROFILE_UPDATE' ? '#dbeafe'
                                : log.action === 'LOGIN' ? '#dcfce7'
                                : log.action === 'FORCE_LOGOUT' ? '#fee2e2'
                                : '#f1f5f9',
                              color:
                                log.action === 'PASSWORD_CHANGE' ? '#92400e'
                                : log.action === 'PROFILE_UPDATE' ? '#1e40af'
                                : log.action === 'LOGIN' ? '#166534'
                                : log.action === 'FORCE_LOGOUT' ? '#991b1b'
                                : '#475569',
                              borderRadius: '8px',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#475569', maxWidth: 400 }}>
                            {log.details || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {log.ip_address || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {hasMoreLogs && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => fetchActivityLogs(logsOffset, true)}
                    disabled={logsLoading}
                    sx={{
                      textTransform: 'none',
                      borderRadius: '10px',
                      borderColor: '#e2e8f0',
                      color: '#64748b',
                      fontWeight: 600,
                      '&:hover': { borderColor: '#7c3aed', color: '#7c3aed' },
                    }}
                  >
                    {logsLoading ? <CircularProgress size={16} /> : 'Load More'}
                  </Button>
                </Box>
              )}
            </>
          )}
        </SettingSection>
      </Box>
    </CaseManagerLayout>
  );
};

export default SettingsPage;
