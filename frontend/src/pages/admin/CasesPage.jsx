import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Chip,
  TablePagination,
  InputAdornment,
  CircularProgress,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Search,
  Add,
  FolderOpen,
  Schedule,
  CheckCircle,
  Warning,
  ExpandMore,
  ChevronRight,
  Delete,
  Edit,
  Close,
  Visibility,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
import CreateCaseDialog from './components/CreateCaseDialog';
import api from '../../services/api';
import useAutoRefresh from '../../hooks/useAutoRefresh';

// Full case status colors (incident_case_db values)
const fullCaseStatusColors = {
  'WIP': '#f6ad55',
  'Pending CS': '#ed8936',
  'Completed': '#48bb78',
  'IR-Writing': '#4299e1',
  'NI': '#a0aec0',
  'Withdraw': '#f56565',
  'QC-1': '#9f7aea',
  'Pending Additional Docs': '#ed8936',
  'Connected Pending': '#b794f4',
  'RCU Pending': '#76e4f7',
  'Portal Upload': '#667eea',
};

// Investigation report status colors
const irStatusColors = {
  'Open': '#4299e1',
  'Approval': '#f6ad55',
  'Stop': '#f56565',
  'QC': '#9f7aea',
  'Dispatch': '#48bb78',
};

// Verification check_status colors
const checkStatusColors = {
  'Not Initiated': '#a0aec0',
  'WIP': '#f6ad55',
  'Completed': '#48bb78',
  'Stop': '#f56565',
};

// Case type chip colors
const caseTypeColors = {
  'Full Case': '#667eea',
  'Partial Case': '#9f7aea',
  'Reassessment': '#4299e1',
  'Connected Case': '#76e4f7',
};

const CasesPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fullCaseStatusFilter, setFullCaseStatusFilter] = useState('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCases, setTotalCases] = useState(0);
  const [selected, setSelected] = useState([]);
  const [expandedCases, setExpandedCases] = useState({});

  // Vendor assignment modal state
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorList, setVendorList] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorAssigning, setVendorAssigning] = useState(false);
  const [vendorModalTarget, setVendorModalTarget] = useState(null); // { caseId, checkType, vendorName }

  // Delete case modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [activePhotoPreview, setActivePhotoPreview] = useState(null);

  // Review action states
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewVendorId, setReviewVendorId] = useState('');
  const [confirmAcceptOpen, setConfirmAcceptOpen] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch data on mount
  useEffect(() => {
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, fullCaseStatusFilter, caseTypeFilter]);

  const fetchData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);

      const [statsRes, casesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/cases/incident-db', {
          params: {
            page: page + 1,
            page_size: rowsPerPage,
            full_case_status: fullCaseStatusFilter !== 'all' ? fullCaseStatusFilter : undefined,
            case_type: caseTypeFilter !== 'all' ? caseTypeFilter : undefined,
            search: searchTerm || undefined,
          },
        }),
      ]);

      setStats(statsRes.data);
      setCases(casesRes.data.cases || []);
      setTotalCases(casesRes.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useAutoRefresh(fetchData);

  // Search handler with debounce
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
  };

  // Trigger search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchData();
    }
  };

  // Build stats data from API response
  const statsData = stats ? [
    {
      title: 'Total Cases',
      value: stats.total_cases || 0,
      change: stats.total_change || 0,
      icon: FolderOpen,
      iconBgColor: '#e3f2fd',
    },
    {
      title: 'Active Investigations',
      value: stats.active_investigations || 0,
      change: stats.active_change || 0,
      icon: Schedule,
      iconBgColor: '#fff3e0',
    },
    {
      title: 'Completed Cases',
      value: stats.completed_cases || 0,
      change: stats.completed_change || 0,
      icon: CheckCircle,
      iconBgColor: '#e8f5e9',
    },
    {
      title: 'Overdue Cases',
      value: stats.overdue_cases || 0,
      change: stats.overdue_change || 0,
      icon: Warning,
      iconBgColor: '#ffebee',
    },
  ] : [];

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = cases.map((n) => n.id);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  const handleSelect = (id) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  // Create case handler
  const handleCreateCase = () => {
    navigate('/admin/cases/new');
  };

  // Toggle case expansion
  const toggleCaseExpansion = (caseId) => {
    setExpandedCases(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  // Sub-items come directly from API (incident_case_db verification tables)
  const getSubCases = (caseData) => caseData.sub_items || [];

  const typeToSlug = {
    'Claimant Check': 'claimant',
    'Insured Check': 'insured',
    'Driver Check': 'driver',
    'Spot Check': 'spot',
    'Chargesheet': 'chargesheet',
    'RTI Check': 'rti',
    'RTO Check': 'rto',
  };

  // Open vendor assignment modal for a sub-check
  const openVendorModal = async (caseId, checkType, currentVendorId = '') => {
    setVendorModalTarget({ caseId, checkType });
    setSelectedVendorId(currentVendorId ? String(currentVendorId) : '');
    setVendorModalOpen(true);
    try {
      const res = await api.get('/check-vendors');
      setVendorList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
      setVendorList([]);
    }
  };

  // Assign vendor to sub-check
  const handleAssignVendorToCheck = async () => {
    if (!vendorModalTarget) return;
    const { caseId, checkType } = vendorModalTarget;
    const slug = typeToSlug[checkType] || checkType.toLowerCase();
    try {
      setVendorAssigning(true);
      await api.patch(`/cases/incident-db/${caseId}/check/${slug}/reassign`, {
        vendor_id: selectedVendorId ? parseInt(selectedVendorId, 10) : null,
      });
      setVendorModalOpen(false);
      setVendorModalTarget(null);
      setSelectedVendorId('');
      await fetchData();
    } catch (err) {
      console.error('Failed to update vendor:', err);
      alert('Failed to update vendor. Please try again.');
    } finally {
      setVendorAssigning(false);
    }
  };

  // Open Review modal for a sub-check
  const openReviewModal = async (caseId, checkTypeLabel) => {
    const slug = typeToSlug[checkTypeLabel] || checkTypeLabel.toLowerCase();
    try {
      setReviewLoading(true);
      setReviewModalOpen(true);
      setReviewAction(null);
      setReviewFeedback('');
      setReviewVendorId('');

      const res = await api.get(`/cases/incident-db/${caseId}/check/${slug}`);
      setReviewData(res.data);

      const vRes = await api.get('/check-vendors');
      setVendorList(vRes.data || []);
    } catch (err) {
      console.error('Failed to fetch check detail for review:', err);
      alert('Failed to load check details');
      setReviewModalOpen(false);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReviewSubmit = async (action) => {
    if (action === 'reject' && (!reviewFeedback || !reviewVendorId)) {
      setSnackbar({ open: true, message: "Please provide feedback and select a new vendor for reassignment.", severity: 'warning' });
      return;
    }

    if (action === 'reject' && !confirmRejectOpen) {
      setConfirmRejectOpen(true);
      return;
    }

    if (action === 'accept' && !confirmAcceptOpen) {
      setConfirmAcceptOpen(true);
      return;
    }

    try {
      setReviewLoading(true);
      const slug = typeToSlug[reviewData.check_type] || reviewData.check_type?.toLowerCase() || '';
      await api.post(`/cases/incident-db/${reviewData.case.id}/check/${slug}/review`, {
        action: action,
        feedback: action === 'reject' ? reviewFeedback : null,
        new_vendor_id: action === 'reject' ? parseInt(reviewVendorId, 10) : null
      });
      setReviewModalOpen(false);
      setReviewData(null);
      setReviewAction(null);
      setReviewFeedback('');
      setReviewVendorId('');
      setConfirmAcceptOpen(false);
      setConfirmRejectOpen(false);
      fetchData();
      setSnackbar({
        open: true,
        message: action === 'accept' ? "Check has been successfully accepted!" : "Check has been rejected and reassigned successfully!",
        severity: 'success'
      });
    } catch (err) {
      console.error('Failed to submit review:', err);
      setSnackbar({
        open: true,
        message: 'Failed to submit review',
        severity: 'error'
      });
    } finally {
      setReviewLoading(false);
    }
  };

  // Delete case handler (supports single or bulk delete)
  const handleDeleteCase = async () => {
    try {
      setDeleting(true);
      if (caseToDelete) {
        await api.delete(`/cases/incident-db/${caseToDelete.id}`);
      } else if (selected.length > 0) {
        await Promise.all(selected.map((id) => api.delete(`/cases/incident-db/${id}`)));
      }
      setDeleteDialogOpen(false);
      setCaseToDelete(null);
      setSelected([]);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete case(s):', error);
      alert(error.response?.data?.detail || error.response?.data?.error || 'Failed to delete case(s). Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (caseData = null) => {
    setCaseToDelete(caseData);
    setDeleteDialogOpen(true);
  };

  // Close delete confirmation dialog
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCaseToDelete(null);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Show only the company name in the list (strip trailing "- CODE" or "– CODE").
  const displayClientName = (rawName) => {
    if (!rawName) return '—';
    return String(rawName).replace(/\s*[\u2013-]\s*[A-Za-z0-9]+\s*$/, '').trim() || rawName;
  };

  if (loading && cases.length === 0) {
    return (
      <AdminLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          Cases
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, width: '100%' }}>
        {statsData.map((stat, index) => (
          <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
            <StatCard {...stat} />
          </Box>
        ))}
      </Box>

      {/* Main Content */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          overflow: 'hidden',
        }}
      >
        {/* Filters and Search */}
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <TextField
              placeholder="Search cases..."
              size="small"
              value={searchTerm}
              onChange={handleSearch}
              onKeyPress={handleSearchKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#999', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: '250px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  backgroundColor: '#f5f5f5',
                  '& fieldset': { border: 'none' },
                },
              }}
            />

            {/* Full Case Status Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={fullCaseStatusFilter}
                onChange={(e) => { setFullCaseStatusFilter(e.target.value); setPage(0); }}
                displayEmpty
                sx={{ borderRadius: '8px', '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' } }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="WIP">WIP</MenuItem>
                <MenuItem value="Pending CS">Pending CS</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="IR-Writing">IR-Writing</MenuItem>
                <MenuItem value="NI">NI</MenuItem>
                <MenuItem value="Withdraw">Withdraw</MenuItem>
                <MenuItem value="QC-1">QC-1</MenuItem>
                <MenuItem value="Pending Additional Docs">Pending Docs</MenuItem>
                <MenuItem value="Portal Upload">Portal Upload</MenuItem>
              </Select>
            </FormControl>

            {/* Case Type Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={caseTypeFilter}
                onChange={(e) => { setCaseTypeFilter(e.target.value); setPage(0); }}
                displayEmpty
                sx={{ borderRadius: '8px', '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' } }}
              >
                <MenuItem value="all">All Case Types</MenuItem>
                <MenuItem value="Full Case">Full Case</MenuItem>
                <MenuItem value="Partial Case">Partial Case</MenuItem>
                <MenuItem value="Reassessment">Reassessment</MenuItem>
                <MenuItem value="Connected Case">Connected Case</MenuItem>
              </Select>
            </FormControl>

            {/* Clear Filters */}
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setSearchTerm('');
                setFullCaseStatusFilter('all');
                setCaseTypeFilter('all');
                setPage(0);
              }}
              sx={{
                color: '#667eea',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#f0f4ff' },
              }}
            >
              Clear Filters
            </Button>

            {/* Delete button (Left side of New Case button when cases are selected) */}
            {selected.length > 0 && (
              <Button
                variant="contained"
                startIcon={<Delete />}
                onClick={() => openDeleteDialog(null)}
                sx={{
                  ml: 'auto',
                  backgroundColor: '#f56565',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: '8px',
                  px: 2,
                  '&:hover': { backgroundColor: '#e53e3e' },
                }}
              >
                Delete ({selected.length})
              </Button>
            )}

            {/* New Case Button */}
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateCase}
              sx={{
                ml: selected.length > 0 ? 1 : 'auto',
                backgroundColor: '#667eea',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                px: 2.5,
                '&:hover': { backgroundColor: '#5568d3' },
              }}
            >
              New Case
            </Button>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <Table sx={{ minWidth: 1200, '& .MuiTableCell-root': { borderRight: '1px solid #edf2f7', py: 1 } }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < cases.length}
                    checked={cases.length > 0 && selected.length === cases.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px', width: 40 }}></TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px', width: 50 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>Case Number</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>Claim Number</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>Client Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>Case Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>Case Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>IR Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>SLA</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px' }}>TAT Days</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '14px', borderRight: 'none' }}>Last Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map((row) => {
                const isItemSelected = isSelected(row.id);
                const subItems = getSubCases(row);
                const isExpanded = expandedCases[row.id];
                const fcColor = fullCaseStatusColors[row.full_case_status] || '#a0aec0';
                const irColor = irStatusColors[row.investigation_report_status] || '#a0aec0';
                const ctColor = caseTypeColors[row.case_type] || '#667eea';

                return (
                  <>
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ '&:last-child td': { border: 0 } }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={isItemSelected} onChange={() => handleSelect(row.id)} />
                      </TableCell>

                      {/* Expand toggle */}
                      <TableCell sx={{ width: 40, p: 0 }}>
                        {subItems.length > 0 && (
                          <IconButton size="small" onClick={() => toggleCaseExpansion(row.id)}>
                            {isExpanded ? <ExpandMore /> : <ChevronRight />}
                          </IconButton>
                        )}
                      </TableCell>

                      {/* Sequential # */}
                      <TableCell>
                        <Typography sx={{ color: '#667eea', fontWeight: 700, fontSize: '15px' }}>
                          {row.seq_num}
                        </Typography>
                      </TableCell>

                      {/* Case Number */}
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#764ba2' }}>
                          {row.case_number || '—'}
                        </Typography>
                      </TableCell>

                      {/* Claim Number */}
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '15px' }}>
                          {row.claim_number || '—'}
                        </Typography>
                      </TableCell>

                      {/* Client Name */}
                      <TableCell>
                        <Typography sx={{ fontSize: '15px' }}>{displayClientName(row.client_name)}</Typography>
                      </TableCell>

                      {/* Case Type */}
                      <TableCell>
                        <Chip
                          label={row.case_type || '—'}
                          size="small"
                          sx={{
                            backgroundColor: `${ctColor}18`,
                            color: ctColor,
                            fontWeight: 600,
                            fontSize: '12px',
                            height: '24px',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <Typography sx={{ fontSize: '15px' }}>{row.category || '—'}</Typography>
                      </TableCell>

                      {/* Full Case Status */}
                      <TableCell>
                        <Chip
                          label={row.full_case_status || '—'}
                          size="small"
                          sx={{
                            backgroundColor: `${fcColor}20`,
                            color: fcColor,
                            fontWeight: 600,
                            fontSize: '12px',
                            height: '24px',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      {/* IR Status */}
                      <TableCell>
                        <Chip
                          label={row.investigation_report_status || '—'}
                          size="small"
                          sx={{
                            backgroundColor: `${irColor}20`,
                            color: irColor,
                            fontWeight: 600,
                            fontSize: '12px',
                            height: '24px',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      {/* SLA */}
                      <TableCell>
                        {row.sla ? (
                          <Chip
                            label={row.sla}
                            size="small"
                            sx={{
                              backgroundColor: row.sla === 'WT' ? '#e8f5e920' : '#fff3e020',
                              color: row.sla === 'WT' ? '#2e7d32' : '#e65100',
                              fontWeight: 700,
                              fontSize: '12px',
                              height: '24px',
                              borderRadius: '6px',
                            }}
                          />
                        ) : <Typography sx={{ fontSize: '14px', color: '#aaa' }}>—</Typography>}
                      </TableCell>

                      {/* TAT Days */}
                      <TableCell>
                        <Typography sx={{ fontSize: '15px', textAlign: 'center' }}>
                          {row.tat_days ?? '—'}
                        </Typography>
                      </TableCell>

                      {/* Last Updated */}
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', color: '#666' }}>
                          {formatDate(row.updated_at)}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* ── Sub-items (verification checks) ── */}
                    {subItems.length > 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={13}
                          sx={{ py: 0, borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none', p: 0 }}
                        >
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ backgroundColor: '#f5f7ff', borderLeft: '4px solid #667eea', p: 1 }}>
                              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #d0d5f5', borderRadius: '6px' }}>
                                <Table size="small">
                                  <TableHead sx={{ backgroundColor: '#eef0fb' }}>
                                    <TableRow>
                                      {['Sub ID', 'Type', 'Name / Subject', 'Contact', 'Location', 'Status', 'Assigned Vendor', 'Review'].map((h) => (
                                        <TableCell key={h} align="center" sx={{ fontSize: '12px', fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.4px', borderRight: '1px solid #d0d5f5', py: 2 }}>
                                          {h}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {subItems.map((sub, idx) => {
                                      const sc = checkStatusColors[sub.check_status] || '#a0aec0';
                                      return (
                                        <TableRow
                                          key={sub.sub_id}
                                          hover
                                          onClick={() => {
                                            const slug = typeToSlug[sub.type];
                                            if (slug) navigate(`/admin/cases/${row.id}/check/${slug}`);
                                          }}
                                          sx={{
                                            cursor: 'pointer',
                                            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9faff',
                                            '& td': { borderRight: '1px solid #eceef8', py: 2 },
                                            '&:last-child td, &:last-child th': { borderBottom: 0 }
                                          }}
                                        >
                                          <TableCell align="center" sx={{ fontWeight: 700, fontSize: '14px', color: '#667eea' }}>{sub.sub_id}</TableCell>
                                          <TableCell align="center" sx={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>{sub.type}</TableCell>
                                          <TableCell align="center" sx={{ fontSize: '13px', color: '#333' }}><Typography align="center" noWrap title={sub.name} sx={{ fontSize: 'inherit', maxWidth: '150px', mx: 'auto' }}>{sub.name}</Typography></TableCell>
                                          <TableCell align="center" sx={{ fontSize: '13px', color: '#555' }}><Typography align="center" noWrap title={sub.contact} sx={{ fontSize: 'inherit', maxWidth: '120px', mx: 'auto' }}>{sub.contact}</Typography></TableCell>
                                          <TableCell align="center" sx={{ fontSize: '13px', color: '#555' }}><Typography align="center" noWrap title={sub.location} sx={{ fontSize: 'inherit', maxWidth: '150px', mx: 'auto' }}>{sub.location}</Typography></TableCell>
                                          <TableCell align="center">
                                            <Chip label={sub.check_status} size="small" sx={{ backgroundColor: `${sc}22`, color: sc, fontWeight: 700, fontSize: '12px', height: '26px', borderRadius: '6px' }} />
                                          </TableCell>
                                          <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                            {sub.assigned_vendor_name ? (
                                              <Button size="small" variant="text" startIcon={<Edit sx={{ fontSize: 14 }} />} onClick={() => openVendorModal(row.id, sub.type, sub.assigned_vendor_id)} sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 700, color: '#2e7d32', py: 0, px: 0.5, minWidth: 0, justifyContent: 'center', mx: 'auto' }} title={`Change vendor from ${sub.assigned_vendor_name}`}>
                                                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{sub.assigned_vendor_name}</Box>
                                              </Button>
                                            ) : (
                                              <Button size="small" variant="outlined" onClick={() => openVendorModal(row.id, sub.type)} sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 600, borderColor: '#667eea', color: '#667eea', py: 0.5, px: 1.5, minWidth: 'auto', mx: 'auto' }}>Assign</Button>
                                            )}
                                          </TableCell>
                                          <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                            {sub.check_status === 'Verified' ? (
                                              <Button size="small" variant="text" onClick={() => openReviewModal(row.id, sub.type)} sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#48bb78', fontSize: '13px', textDecoration: 'underline' }}>Accepted</Typography>
                                              </Button>
                                            ) : (
                                              <Button size="medium" variant="contained" startIcon={<Visibility sx={{ fontSize: 16 }} />} onClick={() => openReviewModal(row.id, sub.type)} sx={{ textTransform: 'none', fontSize: '13px', fontWeight: 700, backgroundColor: '#667eea', color: '#fff', py: 0.75, px: 2, minWidth: 0, boxShadow: 'none', mx: 'auto' }}>Review</Button>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {!loading && cases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No cases found. Try adjusting your filters or create a new case.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <Typography sx={{ fontSize: '14px', color: '#666' }}>
            {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalCases)} of {totalCases.toLocaleString()}
          </Typography>
          <TablePagination
            component="div"
            count={totalCases}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            sx={{
              '& .MuiTablePagination-select': {
                borderRadius: '6px',
              },
            }}
          />
        </Box>
      </Paper>

      {/* Vendor Assignment Modal */}
      <Dialog
        open={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1 }}>
          {selectedVendorId ? 'Change Vendor' : 'Assign Vendor'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: '#666', mb: 2 }}>
            Select a vendor for this check, or clear the assignment to remove it from the current vendor.
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              displayEmpty
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {vendorList.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.company_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setVendorModalOpen(false)}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={vendorAssigning}
            onClick={handleAssignVendorToCheck}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#667eea',
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#5568d3' },
            }}
          >
            {vendorAssigning ? <CircularProgress size={20} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Case Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1 }}>
          Delete {caseToDelete ? 'Case' : 'Selected Cases'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#666', mb: 2 }}>
            {caseToDelete ? (
              <>Are you sure you want to delete case <strong>{caseToDelete.case_number}</strong>?</>
            ) : (
              <>Are you sure you want to delete <strong>{selected.length} selected case(s)</strong>?</>
            )}
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#999' }}>
            This action will permanently delete the case(s) and all related verification checks. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={closeDeleteDialog}
            disabled={deleting}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={deleting}
            onClick={handleDeleteCase}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#f56565',
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#e53e3e' },
            }}
          >
            {deleting ? <CircularProgress size={20} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Review Check Modal */}
      <Dialog
        open={reviewModalOpen}
        onClose={() => { setReviewModalOpen(false); setReviewData(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '12px', overflow: 'hidden' }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2, bgcolor: '#667eea', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" fontWeight="700">
              Check Details &amp; Evidence Review
            </Typography>
            {reviewData?.check?.check_status && (
              <Chip
                label={reviewData.check.check_status}
                size="small"
                sx={{
                  bgcolor: reviewData.check.check_status === 'Completed' ? '#48bb78' : '#f6ad55',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '11px',
                }}
              />
            )}
          </Box>
          <IconButton size="small" onClick={() => { setReviewModalOpen(false); setReviewData(null); }} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3, backgroundColor: '#f8f9fa' }}>
          {reviewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
              <CircularProgress size={40} />
            </Box>
          ) : reviewData ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Case & Check Header Info */}
              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <Table size="small" sx={{ minWidth: 400 }}>
                  <TableBody>
                    <TableRow sx={{ bgcolor: '#f7fafc' }}>
                      <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                        Case Number
                      </TableCell>
                      <TableCell sx={{ color: '#2d3748', fontWeight: 700, wordBreak: 'break-word', py: 1.5 }}>
                        {reviewData.case?.case_number || '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#ffffff' }}>
                      <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                        Claim Number
                      </TableCell>
                      <TableCell sx={{ color: '#2d3748', fontWeight: 700, wordBreak: 'break-word', py: 1.5 }}>
                        {reviewData.case?.claim_number || '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#f7fafc' }}>
                      <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                        Client
                      </TableCell>
                      <TableCell sx={{ color: '#2d3748', fontWeight: 700, wordBreak: 'break-word', py: 1.5 }}>
                        {reviewData.case?.client_name || '—'}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 }, bgcolor: '#ffffff' }}>
                      <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                        Check Type
                      </TableCell>
                      <TableCell sx={{ color: '#667eea', fontWeight: 700, textTransform: 'capitalize', wordBreak: 'break-word', py: 1.5 }}>
                        {reviewData.check_type || '—'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              {/* Check Fields Info */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Check Information
                </Typography>
                <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <Table size="small" sx={{ minWidth: 400 }}>
                    <TableBody>
                      {Object.entries(reviewData.check || {})
                        .filter(([k, v]) =>
                          !['id', 'case_id', 'created_at', 'updated_at', 'vendor_evidence', 'evidence', 'evidence_photos', 'statement_audio', 'statement_audio_url', 'statement', 'statement_mr', 'statement_en', 'statement_transcript_updated_at', 'statement_entries', 'statement_transcript_mr', 'statement_transcript_provider', 'statement_transcript_confidence', 'claimant_lat', 'claimant_lng', 'insured_lat', 'insured_lng', 'driver_lat', 'driver_lng', 'spot_lat', 'spot_lng', 'statement_transcript_en', 'statement_audio_path', 'vendor_documents', 'admin_feedback', 'is_reassigned'].includes(k)
                        )
                        .map(([key, val], index) => {
                          const displayVal = val === null || val === undefined || val === '' || val === '[]' || val === '{}'
                            ? 'NA'
                            : Array.isArray(val)
                              ? (val.length > 0 ? val.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ') : 'NA')
                              : (typeof val === 'object' && val !== null ? (Object.keys(val).length > 0 ? JSON.stringify(val) : 'NA') : String(val));
                          return (
                            <TableRow key={key} sx={{ '&:last-child td': { border: 0 }, bgcolor: index % 2 === 0 ? '#f7fafc' : '#ffffff' }}>
                              <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                                {key.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell sx={{ color: '#2d3748', wordBreak: 'break-word', py: 1.5 }}>
                                {displayVal}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </Box>
              </Paper>

              {/* Vendor Statements */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Vendor Statements
                </Typography>

                {/* Main Statement */}
                {reviewData.check?.statement && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600 }}>STATEMENT</Typography>
                    <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#f7fafc', borderRadius: '6px', border: '1px solid #edf2f7', color: '#2d3748', whiteSpace: 'pre-line' }}>
                      {reviewData.check.statement}
                    </Typography>
                  </Box>
                )}

                {/* Marathi Transcript */}
                {reviewData.check?.statement_mr && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600 }}>STATEMENT (MARATHI TRANSCRIPT)</Typography>
                    <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#f7fafc', borderRadius: '6px', border: '1px solid #edf2f7', color: '#2d3748', whiteSpace: 'pre-line' }}>
                      {reviewData.check.statement_mr}
                    </Typography>
                  </Box>
                )}

                {/* English Transcript */}
                {reviewData.check?.statement_en && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600 }}>STATEMENT (ENGLISH TRANSCRIPT)</Typography>
                    <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#f7fafc', borderRadius: '6px', border: '1px solid #edf2f7', color: '#2d3748', whiteSpace: 'pre-line' }}>
                      {reviewData.check.statement_en}
                    </Typography>
                  </Box>
                )}

                {/* Audio Recording */}
                {reviewData.check?.statement_audio_url && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600, display: 'block', mb: 0.5 }}>AUDIO RECORDING</Typography>
                    <audio controls src={reviewData.check.statement_audio_url} style={{ width: '100%', borderRadius: '8px' }} />
                  </Box>
                )}

                {!reviewData.check?.statement && !reviewData.check?.statement_mr && !reviewData.check?.statement_en && !reviewData.check?.statement_audio_url && (
                  <Typography variant="body2" sx={{ color: '#a0aec0', fontStyle: 'italic' }}>
                    No vendor statements available for this check.
                  </Typography>
                )}
              </Paper>

              {/* Evidence Photos Preview */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Evidence Photos ({reviewData.check?.evidence_photos?.length || 0})
                </Typography>

                {reviewData.check?.evidence_photos && reviewData.check.evidence_photos.length > 0 ? (
                  <Grid container spacing={2}>
                    {reviewData.check.evidence_photos.map((photo, pIdx) => (
                      <Grid item xs={6} sm={4} md={3} key={pIdx}>
                        <Paper
                          elevation={0}
                          onClick={() => setActivePhotoPreview(photo.preview_url || photo.url)}
                          sx={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'scale(1.02)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                          }}
                        >
                          <Box
                            component="img"
                            src={photo.preview_url || photo.url}
                            alt={photo.filename || `Evidence ${pIdx + 1}`}
                            sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block', bgcolor: '#f7fafc' }}
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Image+Error'; }}
                          />
                          <Box sx={{ p: 1, bgcolor: '#fafafa', borderTop: '1px solid #e2e8f0' }}>
                            <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, color: '#4a5568', fontSize: '11px' }}>
                              {photo.filename || `Photo ${pIdx + 1}`}
                            </Typography>
                            {photo.timestamp && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5 }}>
                                🕒 {new Date(photo.timestamp).toLocaleString()}
                              </Typography>
                            )}
                            {(photo.location_name || (photo.latitude && photo.longitude)) && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                📍 {photo.location_name || `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`}
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" sx={{ color: '#a0aec0', fontStyle: 'italic' }}>
                    No evidence photos uploaded for this check yet.
                  </Typography>
                )}
              </Paper>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          {reviewAction === 'reject' && (
            <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 2, width: '100%', bgcolor: '#f7fafc', p: 2, borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#e53e3e' }}>Reject Check &amp; Reassign</Typography>
              <TextField
                label="Feedback for Vendor"
                multiline
                rows={3}
                fullWidth
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder="Explain why this check is being rejected..."
                size="small"
              />
              <FormControl fullWidth size="small">
                <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, color: '#4a5568' }}>Select Vendor to Reassign</Typography>
                <Select
                  value={reviewVendorId}
                  onChange={(e) => setReviewVendorId(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="" disabled>Select Vendor</MenuItem>
                  {vendorList.map((v) => (
                    <MenuItem key={v.id} value={v.id}>{v.company_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                <Button onClick={() => setReviewAction(null)} size="small" variant="text" sx={{ color: '#718096' }}>Cancel</Button>
                <Button onClick={() => handleReviewSubmit('reject')} size="small" variant="contained" color="error" disabled={!reviewFeedback || !reviewVendorId}>Submit Rejection</Button>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, width: '100%' }}>
            <Button onClick={() => { setReviewModalOpen(false); setReviewData(null); setReviewAction(null); }} variant="outlined" sx={{ textTransform: 'none', color: '#718096', borderColor: '#cbd5e0', borderRadius: '6px' }}>
              Close
            </Button>
            {(reviewData?.check?.check_status === 'Completed' || reviewData?.check?.check_status === 'Verified') && (
              <>
                <Button onClick={() => setReviewAction('reject')} variant="outlined" color="error" sx={{ textTransform: 'none', borderRadius: '6px', px: 3 }}>
                  Reject
                </Button>
                {reviewData?.check?.check_status !== 'Verified' && (
                  <Button onClick={() => handleReviewSubmit('accept')} variant="contained" color="success" sx={{ textTransform: 'none', borderRadius: '6px', px: 3, bgcolor: '#48bb78', '&:hover': { bgcolor: '#38a169' } }}>
                    Accept
                  </Button>
                )}
              </>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Lightbox Photo Preview Modal */}
      <Dialog
        open={Boolean(activePhotoPreview)}
        onClose={() => setActivePhotoPreview(null)}
        maxWidth="md"
      >
        <Box sx={{ position: 'relative', p: 1, bgcolor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <IconButton
            onClick={() => setActivePhotoPreview(null)}
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
          >
            <Close />
          </IconButton>
          {activePhotoPreview && (
            <Box
              component="img"
              src={activePhotoPreview}
              alt="Evidence Preview"
              sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          )}
        </Box>
      </Dialog>

      {/* Confirmation Dialog for Accept */}
      <Dialog open={confirmAcceptOpen} onClose={() => setConfirmAcceptOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Acceptance</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: '#475569' }}>
            Are you sure you want to accept this check? This will mark it as Verified.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmAcceptOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
          <Button onClick={() => handleReviewSubmit('accept')} variant="contained" disabled={reviewLoading} sx={{ backgroundColor: '#48bb78', '&:hover': { backgroundColor: '#38a169' } }}>
            {reviewLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Confirm Accept'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Reject */}
      <Dialog open={confirmRejectOpen} onClose={() => setConfirmRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Rejection</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: '#475569' }}>
            Are you sure you want to reject this check? This will reassign it to the selected vendor.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmRejectOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
          <Button onClick={() => handleReviewSubmit('reject')} variant="contained" color="error" disabled={reviewLoading}>
            {reviewLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Confirm Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for Notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', fontWeight: 600 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AdminLayout>
  );
};

export default CasesPage;
