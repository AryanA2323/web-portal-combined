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
  FormControlLabel,
  Switch,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add as AddIcon,
  Business,
  Search,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import api from '../../services/api';

const EMPTY_FORM = {
  client_code: '',
  client_name: '',
  location: '',
  date_of_commencement: '',
  insured_rate: '',
  claimant_rate: '',
  driver_rate: '',
  dl_rate: '',
  rc_rate: '',
  permit_rate: '',
  spot_rate: '',
  court_rate: '',
  rti_rate: '',
  hospital_rate: '',
  notice_rate: '',
  notice_134_rate: '',
  income_rate: '',
  is_active: true,
};

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
  const [selectedClient, setSelectedClient] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saveLoading, setSaveLoading] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients/all');
      setClients(response.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData({ ...EMPTY_FORM });
    setDialogMode('create');
    setSelectedClient(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (client) => {
    setFormData({
      client_code: client.client_code || '',
      client_name: client.client_name || '',
      location: client.location || '',
      date_of_commencement: client.date_of_commencement || '',
      insured_rate: client.insured_rate ?? '',
      claimant_rate: client.claimant_rate ?? '',
      driver_rate: client.driver_rate ?? '',
      dl_rate: client.dl_rate ?? '',
      rc_rate: client.rc_rate ?? '',
      permit_rate: client.permit_rate ?? '',
      spot_rate: client.spot_rate ?? '',
      court_rate: client.court_rate ?? '',
      rti_rate: client.rti_rate ?? '',
      hospital_rate: client.hospital_rate ?? '',
      notice_rate: client.notice_rate ?? '',
      notice_134_rate: client.notice_134_rate ?? '',
      income_rate: client.income_rate ?? '',
      is_active: client.is_active,
    });
    setDialogMode('edit');
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedClient(null);
    setFormData({ ...EMPTY_FORM });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.client_code.trim()) {
      setError('Client code is required');
      return;
    }
    if (!formData.client_name.trim()) {
      setError('Client name is required');
      return;
    }

    try {
      setSaveLoading(true);
      setError(null);

      const payload = {
        client_code: formData.client_code.trim(),
        client_name: formData.client_name.trim(),
        location: formData.location.trim(),
        date_of_commencement: formData.date_of_commencement || null,
        insured_rate: formData.insured_rate !== '' ? parseFloat(formData.insured_rate) : null,
        claimant_rate: formData.claimant_rate !== '' ? parseFloat(formData.claimant_rate) : null,
        driver_rate: formData.driver_rate !== '' ? parseFloat(formData.driver_rate) : null,
        dl_rate: formData.dl_rate !== '' ? parseFloat(formData.dl_rate) : null,
        rc_rate: formData.rc_rate !== '' ? parseFloat(formData.rc_rate) : null,
        permit_rate: formData.permit_rate !== '' ? parseFloat(formData.permit_rate) : null,
        spot_rate: formData.spot_rate !== '' ? parseFloat(formData.spot_rate) : null,
        court_rate: formData.court_rate !== '' ? parseFloat(formData.court_rate) : null,
        rti_rate: formData.rti_rate !== '' ? parseFloat(formData.rti_rate) : null,
        hospital_rate: formData.hospital_rate !== '' ? parseFloat(formData.hospital_rate) : null,
        notice_rate: formData.notice_rate !== '' ? parseFloat(formData.notice_rate) : null,
        notice_134_rate: formData.notice_134_rate !== '' ? parseFloat(formData.notice_134_rate) : null,
        income_rate: formData.income_rate !== '' ? parseFloat(formData.income_rate) : null,
        is_active: formData.is_active,
      };

      if (dialogMode === 'create') {
        await api.post('/clients', payload);
        setSuccessMessage('Client created successfully!');
      } else {
        await api.put(`/clients/${selectedClient.id}`, payload);
        setSuccessMessage('Client updated successfully!');
      }

      handleCloseDialog();
      await fetchClients();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to save client';
      setError(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/clients/${clientToDelete.id}`);
      setSuccessMessage('Client deleted successfully!');
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      await fetchClients();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete client');
      setDeleteDialogOpen(false);
    }
  };

  // Filter clients by search
  const filteredClients = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.client_name.toLowerCase().includes(q) ||
      c.client_code.toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Business sx={{ fontSize: 32, color: '#667eea' }} />
            <Typography variant="h4" fontWeight={700}>
              Clients
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4293 100%)' },
            }}
          >
            Add Client
          </Button>
        </Box>

        {/* Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {/* Search */}
        <Box sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#999' }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 320, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
        </Box>

        {/* Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Client Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#999' }}>
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client, index) => (
                    <TableRow key={client.id} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Chip
                          label={client.client_code}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            backgroundColor: '#e8eaf6',
                            color: '#3949ab',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{client.client_name}</TableCell>
                      <TableCell>{client.location || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={client.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            backgroundColor: client.is_active ? '#e8f5e9' : '#ffebee',
                            color: client.is_active ? '#2e7d32' : '#c62828',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {client.created_at
                          ? new Date(client.created_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEdit(client)}>
                            <Edit fontSize="small" sx={{ color: '#1976d2' }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteClick(client)}>
                            <Delete fontSize="small" sx={{ color: '#d32f2f' }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {dialogMode === 'create' ? 'Add New Client' : 'Edit Client'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {/* Basic Info */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Client Code *"
                  value={formData.client_code}
                  onChange={(e) => handleInputChange('client_code', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  size="small"
                  label="Client Name *"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Date of Commencement"
                  type="date"
                  value={formData.date_of_commencement}
                  onChange={(e) => handleInputChange('date_of_commencement', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    />
                  }
                  label="Active"
                  sx={{ mt: 0.5 }}
                />
              </Grid>

              {/* Rates Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mt: 1 }}>
                  Investigation Rates (₹)
                </Typography>
              </Grid>
              {[
                { key: 'insured_rate', label: 'Insured' },
                { key: 'claimant_rate', label: 'Claimant' },
                { key: 'income_rate', label: 'Income' },
                { key: 'driver_rate', label: 'Driver' },
                { key: 'dl_rate', label: 'DL' },
                { key: 'rc_rate', label: 'RC' },
                { key: 'permit_rate', label: 'Permit' },
                { key: 'spot_rate', label: 'Spot' },
                { key: 'court_rate', label: 'Court' },
                { key: 'notice_rate', label: 'Notice' },
                { key: 'notice_134_rate', label: '134 Notice' },
                { key: 'rti_rate', label: 'RTI' },
                { key: 'hospital_rate', label: 'Hospital' },
              ].map(({ key, label }) => (
                <Grid item xs={6} sm={3} md={2} key={key}>
                  <TextField
                    fullWidth
                    size="small"
                    label={label}
                    type="number"
                    value={formData[key]}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                  />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saveLoading}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4293 100%)' },
              }}
            >
              {saveLoading ? <CircularProgress size={20} color="inherit" /> : (dialogMode === 'create' ? 'Create' : 'Save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete client{' '}
              <strong>{clientToDelete?.client_name} ({clientToDelete?.client_code})</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
};

export default ClientsPage;
