import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Tooltip,
  InputAdornment,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  OutlinedInput,
  Avatar,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add as AddIcon,
  Business,
  Search,
  Close as CloseIcon,
  AddBusiness,
  LocationOn,
  ReceiptLong,
  CreditCard,
  Assignment,
  CloudUpload,
  CheckCircle,
  Download,
  InfoOutlined,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import AlertMessage from '../../components/common/AlertMessage';
import api from '../../services/api';
import { NotificationBell } from '../../components/case_manager';
import { resolveEvidencePhotoUrl } from '../../utils/mediaUrls';

const EMPTY_FORM = {
  client_code: '',
  client_name: '',
  corporate_address: '',
  gst_no: '',
  pan_no: '',
  scope_of_work: [],
  agreement_copy: null,
  existing_agreement_copy: null,
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

  // View Details Modal state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [clientToView, setClientToView] = useState(null);

  // File input ref
  const fileInputRef = useRef(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchClients();
  }, []);

  // Highlight state
  const [highlightFields, setHighlightFields] = useState(false);
  const [highlightDesc, setHighlightDesc] = useState('');
  const highlightTimerRef = useRef(null);

  const clearHighlight = () => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightFields(false);
    setHighlightDesc('');
  };

  const isFieldModified = (fieldKey) => {
    if (!highlightFields || !highlightDesc) return false;
    const descLower = highlightDesc.toLowerCase();
    
    // If it's a client creation event, do not highlight any fields
    if (descLower.includes('created') || descLower.includes('client_created')) {
      return false;
    }

    if (fieldKey === 'client_code' && (descLower.includes('code') || descLower.includes('client_code'))) return true;
    if (fieldKey === 'client_name' && (descLower.includes('name') || descLower.includes('client_name'))) return true;
    if (fieldKey === 'location' && descLower.includes('location')) return true;
    if (fieldKey === 'corporate_address' && (descLower.includes('corporate') || descLower.includes('address') || descLower.includes('corporate_address'))) return true;
    if (fieldKey === 'gst_no' && (descLower.includes('gst') || descLower.includes('gst_no'))) return true;
    if (fieldKey === 'pan_no' && (descLower.includes('pan') || descLower.includes('pan_no'))) return true;
    if (fieldKey === 'scope_of_work' && (descLower.includes('scope') || descLower.includes('work') || descLower.includes('scope_of_work'))) return true;
    if (fieldKey === 'date_of_commencement' && (descLower.includes('date') || descLower.includes('date_of_commencement'))) return true;
    if (fieldKey === 'agreement_copy' && (descLower.includes('agreement') || descLower.includes('document') || descLower.includes('agreement_copy'))) return true;
    if (fieldKey.includes('rate') && descLower.includes('rate')) return true;
    if (descLower.includes(fieldKey) || descLower.includes(fieldKey.replace(/_/g, ' '))) return true;

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

  const triggerHighlight = (desc = '') => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightFields(true);
    setHighlightDesc(desc);

    highlightTimerRef.current = setTimeout(() => {
      clearHighlight();
    }, 7500);
  };

  // Auto-open target client info modal if navigated from notification
  useEffect(() => {
    if (clients && clients.length > 0 && location.state?.openClientQuery) {
      const targetQuery = String(location.state.openClientQuery).toLowerCase().trim();
      const matched = clients.find(c => {
        const nameLower = (c.client_name || '').toLowerCase();
        const codeLower = (c.client_code || '').toLowerCase();
        return (
          (codeLower && targetQuery.includes(codeLower)) ||
          (nameLower && targetQuery.includes(nameLower)) ||
          (codeLower && codeLower.includes(targetQuery)) ||
          (nameLower && nameLower.includes(targetQuery))
        );
      });

      if (matched) {
        handleOpenViewDetails(matched);
        if (location.state?.highlightFields) {
          triggerHighlight(location.state?.highlightDesc);
        }
        // Clear the state so it doesn't reopen on tab switch / rerender
        navigate(location.pathname, { replace: true, state: { ...location.state, openClientQuery: undefined, highlightFields: undefined, highlightDesc: undefined } });
      }
    }
  }, [clients, location.state, navigate, location.pathname]);

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

  const handleOpenViewDetails = (client) => {
    setClientToView(client);
    setViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setClientToView(null);
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
      corporate_address: client.corporate_address || '',
      gst_no: client.gst_no || '',
      pan_no: client.pan_no || '',
      scope_of_work: client.scope_of_work || [],
      agreement_copy: null,
      existing_agreement_copy: client.agreement_copy || null,
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

  const handleDownloadAgreement = (e) => {
    if (e) e.stopPropagation();
    if (formData.agreement_copy instanceof File) {
      const objectUrl = URL.createObjectURL(formData.agreement_copy);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = formData.agreement_copy.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } else if (formData.existing_agreement_copy) {
      const resolvedUrl = resolveEvidencePhotoUrl(formData.existing_agreement_copy);
      const name = formData.existing_agreement_copy.split('/').pop() || 'Agreement_Document.pdf';
      const a = document.createElement('a');
      a.href = resolvedUrl;
      a.download = name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSave = async () => {
    if (!formData.client_name.trim()) {
      setError('Client name is required');
      return;
    }

    try {
      setSaveLoading(true);
      setError(null);

      const formPayload = new FormData();
      if (formData.client_code) formPayload.append('client_code', formData.client_code.trim());
      formPayload.append('client_name', formData.client_name.trim());
      formPayload.append('corporate_address', formData.corporate_address.trim());
      formPayload.append('gst_no', formData.gst_no.trim());
      formPayload.append('pan_no', formData.pan_no.trim());
      formPayload.append('scope_of_work', JSON.stringify(formData.scope_of_work));
      formPayload.append('is_active', formData.is_active);
      
      if (formData.agreement_copy instanceof File) {
          formPayload.append('agreement_copy', formData.agreement_copy);
      }

      if (dialogMode === 'create') {
        await api.post('/clients', formPayload, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccessMessage('Client created successfully!');
      } else {
        await api.put(`/clients/${selectedClient.id}`, formPayload, { headers: { 'Content-Type': 'multipart/form-data' } });
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
      c.client_code.toLowerCase().includes(q)
    );
  });

  return (
    <CaseManagerLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
            Clients
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            <NotificationBell />
          </Box>
        </Box>

        {/* Messages */}
        <AlertMessage severity="error" onClose={() => setError(null)} message={error} open={!!error} />
        <AlertMessage severity="success" onClose={() => setSuccessMessage(null)} message={successMessage} open={!!successMessage} />

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
                  <TableCell sx={{ fontWeight: 700, fontSize: '15px', py: 1.75 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '15px', py: 1.75 }}>Client Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '15px', py: 1.75 }}>Client Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '15px', py: 1.75 }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '15px', py: 1.75, textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#999', fontSize: '15px' }}>
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client, index) => (
                    <TableRow
                      key={client.id}
                      hover
                      onClick={() => handleOpenViewDetails(client)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          backgroundColor: '#f8fafc',
                        },
                      }}
                    >
                      <TableCell sx={{ fontSize: '15px', py: 1.75 }}>{index + 1}</TableCell>
                      <TableCell sx={{ py: 1.75 }}>
                        <Chip
                          label={client.client_code}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            backgroundColor: '#e8eaf6',
                            color: '#3949ab',
                            fontSize: '13px',
                            height: '26px',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b', fontSize: '15.5px', py: 1.75 }}>{client.client_name}</TableCell>
                      <TableCell sx={{ fontSize: '14.5px', color: '#475569', py: 1.75 }}>
                        {client.created_at
                          ? new Date(client.created_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()} sx={{ py: 1.75 }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEdit(client)}>
                            <Edit sx={{ color: '#1976d2', fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteClick(client)}>
                            <Delete sx={{ color: '#d32f2f', fontSize: 20 }} />
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
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
            },
          }}
        >
          {/* Top Gradient Header */}
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              py: 2.5,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                }}
              >
                <AddBusiness sx={{ fontSize: 24 }} />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {dialogMode === 'create' ? 'Add New Client' : 'Edit Client Details'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, fontSize: '13px', mt: 0.25 }}>
                  {dialogMode === 'create'
                    ? 'Enter client company details & upload agreement copy'
                    : `Editing ${selectedClient?.client_name || 'client'}`}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, backgroundColor: '#fafbfc' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2.5 }}>

              {/* Section 1: Company Profile */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#1e293b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '12px',
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1,
                    px: 1.75,
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px',
                    borderLeft: '4px solid #667eea',
                  }}
                >
                  <Business sx={{ fontSize: 18, color: '#667eea' }} />
                  Company Profile
                </Typography>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Client Name *"
                      placeholder="e.g. Apple Inc. / Mahindra Insurance"
                      value={formData.client_name}
                      onChange={(e) => handleInputChange('client_name', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Business sx={{ color: '#667eea', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        width: '100%',
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#667eea' },
                          '&.Mui-focused fieldset': { borderColor: '#667eea' },
                        },
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      fullWidth
                      label="Corporate Address"
                      placeholder="Enter complete corporate office / registered address"
                      value={formData.corporate_address}
                      onChange={(e) => handleInputChange('corporate_address', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocationOn sx={{ color: '#667eea', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        width: '100%',
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#667eea' },
                          '&.Mui-focused fieldset': { borderColor: '#667eea' },
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Section 2: Tax & Identification */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#1e293b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '12px',
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1,
                    px: 1.75,
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px',
                    borderLeft: '4px solid #667eea',
                  }}
                >
                  <ReceiptLong sx={{ fontSize: 18, color: '#667eea' }} />
                  Tax & Identification
                </Typography>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="GST Number"
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      value={formData.gst_no}
                      onChange={(e) => handleInputChange('gst_no', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ReceiptLong sx={{ color: '#667eea', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#667eea' },
                          '&.Mui-focused fieldset': { borderColor: '#667eea' },
                        },
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="PAN Number"
                      placeholder="e.g. ABCDE1234F"
                      value={formData.pan_no}
                      onChange={(e) => handleInputChange('pan_no', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <CreditCard sx={{ color: '#667eea', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          '&:hover fieldset': { borderColor: '#667eea' },
                          '&.Mui-focused fieldset': { borderColor: '#667eea' },
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Section 3: Scope of Work & Agreement */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#1e293b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '12px',
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1,
                    px: 1.75,
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px',
                    borderLeft: '4px solid #667eea',
                  }}
                >
                  <Assignment sx={{ fontSize: 18, color: '#667eea' }} />
                  Scope of Work & Agreement
                </Typography>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 6 }}>
                    <FormControl
                      fullWidth
                      sx={{
                        width: '100%',
                        minWidth: '100%',
                        maxWidth: '100%',
                        '& .MuiInputLabel-root': { color: '#334155', fontWeight: 600 },
                        '& .MuiOutlinedInput-root': {
                          width: '100%',
                          minWidth: '100%',
                          maxWidth: '100%',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          minHeight: '52px',
                          boxSizing: 'border-box',
                          '&:hover fieldset': { borderColor: '#667eea' },
                          '&.Mui-focused fieldset': { borderColor: '#667eea' },
                        },
                        '& .MuiSelect-select': {
                          width: '100% !important',
                          minWidth: '100% !important',
                          maxWidth: '100% !important',
                          boxSizing: 'border-box',
                          display: 'flex !important',
                          alignItems: 'center',
                          flex: 1,
                          overflow: 'hidden',
                          whiteSpace: 'normal',
                        },
                      }}
                    >
                      <InputLabel id="scope-of-work-label" shrink>Scope of Work</InputLabel>
                      <Select
                        labelId="scope-of-work-label"
                        id="scope-of-work-select"
                        label="Scope of Work"
                        multiple
                        displayEmpty
                        value={formData.scope_of_work || []}
                        onChange={(e) => handleInputChange('scope_of_work', e.target.value)}
                        input={<OutlinedInput label="Scope of Work" notched sx={{ width: '100%', minWidth: '100%', maxWidth: '100%' }} />}
                        sx={{ width: '100%', minWidth: '100%', maxWidth: '100%', display: 'flex', flex: 1 }}
                        renderValue={(selected) => {
                          if (!selected || selected.length === 0) {
                            return (
                              <Typography sx={{ color: '#94a3b8', fontSize: '13.5px', fontWeight: 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Select Scope of Work (e.g. MACT, OD, Theft, WC)
                              </Typography>
                            );
                          }
                          return (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1, alignItems: 'center', maxWidth: '100%', overflow: 'hidden' }}>
                              {selected.map((value) => (
                                <Chip
                                  key={value}
                                  label={value}
                                  size="small"
                                  sx={{
                                    backgroundColor: '#eef2ff',
                                    color: '#4f46e5',
                                    border: '1px solid #c7d2fe',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    height: '24px',
                                  }}
                                />
                              ))}
                            </Box>
                          );
                        }}
                      >
                        {['MACT', 'OD', 'Theft', 'WC'].map((name) => (
                          <MenuItem key={name} value={name}>
                            {name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 6 }}>
                    {/* Hidden single file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      multiple={false}
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleInputChange('agreement_copy', file);
                        }
                      }}
                    />

                    {/* Agreement Box Container */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        px: 1.75,
                        minHeight: '52px',
                        border: '1.5px dashed',
                        borderColor: (formData.agreement_copy || formData.existing_agreement_copy) ? '#667eea' : '#cbd5e1',
                        borderRadius: '10px',
                        backgroundColor: (formData.agreement_copy || formData.existing_agreement_copy) ? '#f8faff' : '#ffffff',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        '&:hover': {
                          borderColor: '#667eea',
                          backgroundColor: '#f8fafc',
                        },
                      }}
                    >
                      {/* Left: Icon and Name/Details */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1, mr: 1 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: (formData.agreement_copy || formData.existing_agreement_copy) ? '#e0e7ff' : '#f1f5f9',
                            color: (formData.agreement_copy || formData.existing_agreement_copy) ? '#4f46e5' : '#64748b',
                          }}
                        >
                          {(formData.agreement_copy || formData.existing_agreement_copy) ? (
                            <CheckCircle sx={{ fontSize: 18, color: '#16a34a' }} />
                          ) : (
                            <CloudUpload sx={{ fontSize: 18 }} />
                          )}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: (formData.agreement_copy || formData.existing_agreement_copy) ? '#1e1b4b' : '#334155',
                              fontSize: '13px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {formData.agreement_copy
                              ? formData.agreement_copy.name
                              : formData.existing_agreement_copy
                                ? (formData.existing_agreement_copy.split('/').pop() || 'Agreement Document')
                                : 'Agreement Copy Upload'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                            {formData.agreement_copy
                              ? `${(formData.agreement_copy.size / 1024).toFixed(1)} KB (Selected)`
                              : formData.existing_agreement_copy
                                ? 'Uploaded Agreement Document'
                                : '1 document (PDF, DOC, or Image)'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Right: Actions */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        {(formData.agreement_copy || formData.existing_agreement_copy) && (
                          <Tooltip title="Download Document">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={handleDownloadAgreement}
                              startIcon={<Download sx={{ fontSize: 14 }} />}
                              sx={{
                                textTransform: 'none',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                borderColor: '#10b981',
                                color: '#059669',
                                py: 0.3,
                                px: 1,
                                minWidth: 'auto',
                                '&:hover': {
                                  borderColor: '#047857',
                                  backgroundColor: '#ecfdf5',
                                },
                              }}
                            >
                              Download
                            </Button>
                          </Tooltip>
                        )}

                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => fileInputRef.current?.click()}
                          sx={{
                            textTransform: 'none',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            borderColor: '#667eea',
                            color: '#667eea',
                            py: 0.3,
                            px: 1.2,
                            minWidth: 'auto',
                            '&:hover': {
                              borderColor: '#4f46e5',
                              backgroundColor: '#eef2ff',
                            },
                          }}
                        >
                          {(formData.agreement_copy || formData.existing_agreement_copy) ? 'Change' : 'Browse'}
                        </Button>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

            </Box>
          </DialogContent>

          {/* Dialog Footer Actions */}
          <DialogActions
            sx={{
              p: 2.5,
              px: 3.5,
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1.5,
            }}
          >
            <Button
              onClick={handleCloseDialog}
              sx={{
                color: '#64748b',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 600,
                px: 3,
                py: 0.8,
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saveLoading}
              startIcon={saveLoading ? <CircularProgress size={18} color="inherit" /> : (dialogMode === 'create' ? <AddIcon /> : <Edit />)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 600,
                px: 4,
                py: 0.8,
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4293 100%)',
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.45)',
                },
              }}
            >
              {saveLoading ? 'Saving...' : (dialogMode === 'create' ? 'Create Client' : 'Save Changes')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Full Info Details Modal */}
        <Dialog
          open={viewDialogOpen}
          onClose={handleCloseViewDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
            },
          }}
        >
          {/* Header */}
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              color: 'white',
              py: 2.5,
              px: 3.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
              <Avatar
                sx={{
                  bgcolor: '#3b82f6',
                  color: 'white',
                  width: 44,
                  height: 44,
                  fontWeight: 700,
                  fontSize: '18px',
                  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)',
                }}
              >
                {clientToView?.client_name?.charAt(0)?.toUpperCase() || 'C'}
              </Avatar>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
                    {clientToView?.client_name || 'Client Details'}
                  </Typography>
                  <Chip
                    label={clientToView?.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '11px',
                      backgroundColor: clientToView?.is_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: clientToView?.is_active ? '#4ade80' : '#f87171',
                      border: `1px solid ${clientToView?.is_active ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '12px' }}>
                  Client Code: <strong>{clientToView?.client_code || '—'}</strong>
                </Typography>
              </Box>
            </Box>
            <IconButton
              size="small"
              onClick={handleCloseViewDialog}
              sx={{ color: '#94a3b8', '&:hover': { color: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, backgroundColor: '#f8fafc' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              
              {/* Section 1: Company Profile & Address */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#334155',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                    pb: 1,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <Business sx={{ fontSize: 18, color: '#667eea' }} />
                  Company Profile & Address
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }} sx={getFieldSx('client_name', 'transparent', 'transparent')}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                      Client Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b', mt: 0.25 }}>
                      {clientToView?.client_name || '—'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }} sx={getFieldSx('client_code', 'transparent', 'transparent')}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                      Client Code
                    </Typography>
                    <Box sx={{ mt: 0.25 }}>
                      <Chip
                        label={clientToView?.client_code || '—'}
                        size="small"
                        sx={{ fontWeight: 700, backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}
                      />
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12 }} sx={getFieldSx('corporate_address', 'transparent', 'transparent')}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOn sx={{ fontSize: 13, color: '#64748b' }} />
                      Corporate Address
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#334155', mt: 0.5, lineHeight: 1.6, backgroundColor: '#f8fafc', p: 1.5, borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      {clientToView?.corporate_address || 'No corporate address provided.'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Section 2: Legal & Tax Identifiers */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#334155',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                    pb: 1,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <ReceiptLong sx={{ fontSize: 18, color: '#667eea' }} />
                  Legal & Tax Identifiers
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }} sx={getFieldSx('gst_no', 'transparent', 'transparent')}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                      GST Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: clientToView?.gst_no ? '#0f172a' : '#94a3b8', mt: 0.25, fontFamily: clientToView?.gst_no ? 'monospace' : 'inherit' }}>
                      {clientToView?.gst_no || 'Not Registered / Provided'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }} sx={getFieldSx('pan_no', 'transparent', 'transparent')}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                      PAN Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: clientToView?.pan_no ? '#0f172a' : '#94a3b8', mt: 0.25, fontFamily: clientToView?.pan_no ? 'monospace' : 'inherit' }}>
                      {clientToView?.pan_no || 'Not Provided'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Section 3: Scope of Work & Agreement */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#334155',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                    pb: 1,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <Assignment sx={{ fontSize: 18, color: '#667eea' }} />
                  Scope of Work & Agreement Document
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }} sx={getFieldSx('scope_of_work', 'transparent', 'transparent')}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px', display: 'block', mb: 0.75 }}>
                      Assigned Scope of Work
                    </Typography>
                    {clientToView?.scope_of_work && clientToView.scope_of_work.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {clientToView.scope_of_work.map((scope) => (
                          <Chip
                            key={scope}
                            label={scope}
                            size="small"
                            sx={{
                              backgroundColor: '#eef2ff',
                              color: '#4f46e5',
                              border: '1px solid #c7d2fe',
                              fontWeight: 700,
                              fontSize: '11.5px',
                            }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                        No scope of work assigned.
                      </Typography>
                    )}
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }} sx={getFieldSx('agreement_copy', 'transparent', 'transparent')}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px', display: 'block', mb: 0.75 }}>
                      Agreement Document
                    </Typography>
                    {clientToView?.agreement_copy ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.25,
                          px: 1.75,
                          borderRadius: '8px',
                          border: '1px solid #c7d2fe',
                          backgroundColor: '#f5f7ff',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, mr: 1 }}>
                          <CheckCircle sx={{ color: '#16a34a', fontSize: 20 }} />
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: '#1e1b4b',
                              fontSize: '12.5px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {clientToView.agreement_copy.split('/').pop() || 'Agreement Document'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            const url = resolveEvidencePhotoUrl(clientToView.agreement_copy);
                            const name = clientToView.agreement_copy.split('/').pop() || `${clientToView.client_name}_Agreement.pdf`;
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = name;
                            a.target = '_blank';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          startIcon={<Download sx={{ fontSize: 14 }} />}
                          sx={{
                            textTransform: 'none',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            py: 0.4,
                            px: 1.25,
                            flexShrink: 0,
                            '&:hover': {
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            },
                          }}
                        >
                          Download
                        </Button>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          p: 1.25,
                          px: 1.75,
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#94a3b8',
                          fontSize: '12.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <InfoOutlined sx={{ fontSize: 16 }} />
                        <span>No agreement copy uploaded</span>
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Paper>

              {/* Meta Info */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, color: '#94a3b8', fontSize: '12px' }}>
                <span>Created: {clientToView?.created_at ? new Date(clientToView.created_at).toLocaleString() : '—'}</span>
                <span>Updated: {clientToView?.updated_at ? new Date(clientToView.updated_at).toLocaleString() : '—'}</span>
              </Box>

            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, px: 3.5, backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => {
                const client = clientToView;
                handleCloseViewDialog();
                handleOpenEdit(client);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '13.5px',
                borderRadius: '8px',
                borderColor: '#667eea',
                color: '#667eea',
                px: 2.5,
                '&:hover': {
                  borderColor: '#4f46e5',
                  backgroundColor: '#eef2ff',
                },
              }}
            >
              Edit Client Details
            </Button>
            <Button
              onClick={handleCloseViewDialog}
              sx={{
                color: '#64748b',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '13.5px',
                borderRadius: '8px',
                px: 3,
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
            >
              Close
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
    </CaseManagerLayout>
  );
};

export default ClientsPage;
