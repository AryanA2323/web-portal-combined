import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Email,
  Psychology,
  Security,
  Notifications,
  Storage,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';

const SettingSection = ({ icon: Icon, title, subtitle, children }) => (
  <Card sx={{ mb: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box
          sx={{
            backgroundColor: '#f8f9fa',
            borderRadius: '10px',
            p: 1.2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ color: '#495057', fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', mb: 0.25 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: '#6c757d', fontSize: '13px' }}>
            {subtitle}
          </Typography>
        </Box>
      </Box>
      {children}
    </CardContent>
  </Card>
);

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    companyName: 'Shovel Screening Project',
    timezone: 'America/Los_Angeles',
    casePrefix: 'CASE-',
    autoAssignVendors: true,
    enableGeotagging: true,
    imapServer: 'imap.gmail.com',
    intakeEmail: 'intake@shovelscreen.com',
    pollInterval: '5',
    enableNLP: true,
    sendConfirmation: true,
    aiModel: 'GPT-4',
    confidenceThreshold: '85',
    autoGenerateBriefs: true,
    enableFactChecking: true,
    require2FA: true,
    sessionTimeout: true,
    auditLogging: true,
    minPasswordLength: '12',
    caseAssignmentNotif: true,
    deadlineReminders: true,
    reportApprovalAlerts: true,
    systemMaintenanceAlerts: true,
    dbHost: 'localhost:5432',
    backupFrequency: 'Daily at 2:00 AM',
    storageLimit: '500',
    autoBackup: true,
    compressUploads: true,
  });

  const handleChange = (field) => (event) => {
    setSettings({
      ...settings,
      [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    });
  };

  const handleSave = (section) => {
    console.log('Saving settings for:', section);
    // API call would go here
  };

  return (
    <AdminLayout>
      <Box sx={{ px: 0.5 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 0.5 }}>
            Settings
          </Typography>
          <Typography variant="body2" sx={{ color: '#6c757d', fontSize: '14px' }}>
            Manage system configuration and preferences
          </Typography>
        </Box>

        <TextField
          fullWidth
          placeholder="Search cases, vendors, users..."
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Box component="span" sx={{ fontSize: 18 }}>🔍</Box>
              </InputAdornment>
            ),
          }}
          sx={{ 
            mb: 4, 
            maxWidth: 450,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fff',
            },
          }}
        />

        {/* General Settings */}
        <SettingSection
          icon={SettingsIcon}
          title="General"
          subtitle="Configure general system settings and preferences"
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, fontSize: '13px' }}>
                Company Name
              </Typography>
              <TextField
                fullWidth
                value={settings.companyName}
                onChange={handleChange('companyName')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, fontSize: '13px' }}>
                Timezone
              </Typography>
              <TextField
                fullWidth
                value={settings.timezone}
                onChange={handleChange('timezone')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, fontSize: '13px' }}>
                Case ID Prefix
              </Typography>
              <TextField
                fullWidth
                value={settings.casePrefix}
                onChange={handleChange('casePrefix')}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoAssignVendors}
                    onChange={handleChange('autoAssignVendors')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500} sx={{ fontSize: '14px' }}>
                      Auto-assign vendors
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6c757d', fontSize: '12px' }}>
                      Automatically assign cases to nearest available vendor
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enableGeotagging}
                    onChange={handleChange('enableGeotagging')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500} sx={{ fontSize: '14px' }}>
                      Enable geotagging validation
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6c757d', fontSize: '12px' }}>
                      Verify photo GPS coordinates match case location
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3, pt: 2, borderTop: '1px solid #f0f0f0' }}>
            <Button variant="outlined" sx={{ textTransform: 'none', px: 3 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#1a1a1a',
                textTransform: 'none',
                px: 3,
                '&:hover': { backgroundColor: '#2c2c2c' },
              }}
              onClick={() => handleSave('general')}
            >
              Save Changes
            </Button>
          </Box>
        </SettingSection>

        {/* Email Integration */}
        <SettingSection
          icon={Email}
          title="Email Integration"
          subtitle="Configure email intake and processing settings"
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                IMAP Server
              </Typography>
              <TextField
                fullWidth
                value={settings.imapServer}
                onChange={handleChange('imapServer')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Intake Email Address
              </Typography>
              <TextField
                fullWidth
                value={settings.intakeEmail}
                onChange={handleChange('intakeEmail')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Poll Interval (minutes)
              </Typography>
              <TextField
                fullWidth
                value={settings.pollInterval}
                onChange={handleChange('pollInterval')}
                size="small"
                type="number"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch checked={settings.enableNLP} onChange={handleChange('enableNLP')} />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Enable NLP extraction
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Use AI to extract case details from email content
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.sendConfirmation}
                    onChange={handleChange('sendConfirmation')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Send confirmation emails
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Notify clients when cases are created
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button variant="outlined" sx={{ textTransform: 'none' }}>
              Test Connection
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#1a1a1a',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#2c2c2c' },
              }}
              onClick={() => handleSave('email')}
            >
              Save Changes
            </Button>
          </Box>
        </SettingSection>

        {/* AI & NLP Configuration */}
        <SettingSection
          icon={Psychology}
          title="AI & NLP Configuration"
          subtitle="Configure AI-powered features and model settings"
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                AI Model
              </Typography>
              <TextField
                fullWidth
                value={settings.aiModel}
                onChange={handleChange('aiModel')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Confidence Threshold (%)
              </Typography>
              <TextField
                fullWidth
                value={settings.confidenceThreshold}
                onChange={handleChange('confidenceThreshold')}
                size="small"
                type="number"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoGenerateBriefs}
                    onChange={handleChange('autoGenerateBriefs')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Auto-generate briefs
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically generate accident briefs when data is complete
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enableFactChecking}
                    onChange={handleChange('enableFactChecking')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Enable fact-checking
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Verify AI-generated content against source data
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button variant="outlined" sx={{ textTransform: 'none' }}>
              Test AI Model
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#1a1a1a',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#2c2c2c' },
              }}
              onClick={() => handleSave('ai')}
            >
              Save Changes
            </Button>
          </Box>
        </SettingSection>

        {/* Security */}
        <SettingSection
          icon={Security}
          title="Security"
          subtitle="Configure authentication and access control"
        >
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch checked={settings.require2FA} onChange={handleChange('require2FA')} />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Require 2FA for admins
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enforce two-factor authentication for admin accounts
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.sessionTimeout}
                    onChange={handleChange('sessionTimeout')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Session timeout
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically log out inactive users after 30 minutes
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.auditLogging}
                    onChange={handleChange('auditLogging')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Audit logging
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Track all user actions and system events
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Minimum Password Length
              </Typography>
              <TextField
                fullWidth
                value={settings.minPasswordLength}
                onChange={handleChange('minPasswordLength')}
                size="small"
                type="number"
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button variant="outlined" sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#1a1a1a',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#2c2c2c' },
              }}
              onClick={() => handleSave('security')}
            >
              Save Changes
            </Button>
          </Box>
        </SettingSection>

        {/* Notifications */}
        <SettingSection
          icon={Notifications}
          title="Notifications"
          subtitle="Configure email and system notifications"
        >
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.caseAssignmentNotif}
                    onChange={handleChange('caseAssignmentNotif')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Case assignment notifications
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Notify vendors when cases are assigned
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.deadlineReminders}
                    onChange={handleChange('deadlineReminders')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Deadline reminders
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Send reminders 2 days before case deadlines
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.reportApprovalAlerts}
                    onChange={handleChange('reportApprovalAlerts')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Report approval alerts
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Notify clients when reports are approved
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.systemMaintenanceAlerts}
                    onChange={handleChange('systemMaintenanceAlerts')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      System maintenance alerts
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Notify admins about system updates
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button variant="outlined" sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#1a1a1a',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#2c2c2c' },
              }}
              onClick={() => handleSave('notifications')}
            >
              Save Changes
            </Button>
          </Box>
        </SettingSection>

        {/* Database & Storage */}
        <SettingSection
          icon={Storage}
          title="Database & Storage"
          subtitle="Configure database and file storage settings"
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Database Host
              </Typography>
              <TextField
                fullWidth
                value={settings.dbHost}
                onChange={handleChange('dbHost')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Backup Frequency
              </Typography>
              <TextField
                fullWidth
                value={settings.backupFrequency}
                onChange={handleChange('backupFrequency')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Storage Limit (GB)
              </Typography>
              <TextField
                fullWidth
                value={settings.storageLimit}
                onChange={handleChange('storageLimit')}
                size="small"
                type="number"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoBackup}
                    onChange={handleChange('autoBackup')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Auto-backup enabled
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically backup database daily
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.compressUploads}
                    onChange={handleChange('compressUploads')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Compress uploaded files
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reduce storage usage by compressing images
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button variant="outlined" sx={{ textTransform: 'none' }}>
              Run Backup Now
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#1a1a1a',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#2c2c2c' },
              }}
              onClick={() => handleSave('storage')}
            >
              Save Changes
            </Button>
          </Box>
        </SettingSection>
      </Box>
    </AdminLayout>
  );
};

export default SettingsPage;
