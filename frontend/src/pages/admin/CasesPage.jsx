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
  Tabs,
  Tab,
  Stack,
  Divider,
  Tooltip,
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
  Description,
  Assignment,
  Collections,
  InsertDriveFile,
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

const QUESTIONNAIRE_LABELS = {
  relation: 'Relation with Deceased / Injured',
  claim_type: 'Type of Claim',
  deceased_injury_name: 'Deceased / Injured Person Name',
  deceased_injury_income: 'Deceased / Injured Income',
  monthly_income: 'Monthly Income of Claimant',
  hr_manager: 'Name & No. of Company HR / Manager',
  fir_date: 'FIR Date',
  reason_if_delayed: 'Reason if Delayed',
  date_of_accident: 'Date of Accident',
  time_of_accident: 'Time of Accident',
  description_of_accident: 'Description of Accident',
  investigation_datetime: 'Date & Time of Investigation',
};

const KNOWN_Q_KEYS = new Set(Object.keys({
  relation: 1, claim_type: 1, deceased_injury_name: 1, deceased_injury_income: 1,
  monthly_income: 1, hr_manager: 1, fir_date: 1, reason_if_delayed: 1, date_of_accident: 1, time_of_accident: 1,
  description_of_accident: 1, investigation_datetime: 1,
}));

const parseQuestionnaire = (rawVal) => {
  if (!rawVal) return null;
  let parsed = rawVal;
  // Handle string (possibly double-serialized)
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    } catch (e) {
      return null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  // Check if the object already has known questionnaire field names
  const knownEntries = {};
  let foundKnown = 0;
  for (const k of Object.keys(parsed)) {
    if (KNOWN_Q_KEYS.has(k)) {
      knownEntries[k] = parsed[k];
      foundKnown++;
    }
  }
  if (foundKnown > 0) return knownEntries;

  // Fallback: if it's a character-indexed object ({"0": "{", "1": "\"", ...})
  if (parsed['0'] !== undefined && parsed['1'] !== undefined) {
    try {
      const numericKeys = Object.keys(parsed).filter(k => /^\d+$/.test(k));
      numericKeys.sort((a, b) => Number(a) - Number(b));
      const str = numericKeys.map(k => parsed[k]).join('');
      let inner = JSON.parse(str);
      if (typeof inner === 'string') inner = JSON.parse(inner);
      if (typeof inner === 'object' && inner !== null && !Array.isArray(inner)) return inner;
    } catch (e) {
      return null;
    }
  }

  // If it has any keys at all, return it as-is (generic questionnaire data)
  if (Object.keys(parsed).length > 0) return parsed;
  return null;
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

  // Full case view modal state
  const [fullCaseModalOpen, setFullCaseModalOpen] = useState(false);
  const [fullCaseLoading, setFullCaseLoading] = useState(false);
  const [fullCaseData, setFullCaseData] = useState(null);
  const [fullCaseTab, setFullCaseTab] = useState(0);
  const [selectedCheckTab, setSelectedCheckTab] = useState(0);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusConfirmAction, setStatusConfirmAction] = useState(null);
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

  const handleToggleCaseStatus = async (caseId, newStatus) => {
    try {
      setStatusLoading(true);
      await api.patch(`/cases/incident-db/${caseId}/status`, { status: newStatus });
      setSnackbar({ open: true, message: `Case status updated to ${newStatus}`, severity: 'success' });
      // Update local state for immediate feedback
      if (fullCaseData && fullCaseData.case.id === caseId) {
        setFullCaseData(prev => ({
          ...prev,
          case: { ...prev.case, full_case_status: newStatus }
        }));
      }
      setCases(prevCases =>
        prevCases.map(c => c.id === caseId ? { ...c, full_case_status: newStatus } : c)
      );
    } catch (error) {
      console.error('Error updating case status:', error);
      setSnackbar({ open: true, message: error.response?.data?.error || 'Failed to update case status', severity: 'error' });
    } finally {
      setStatusLoading(false);
    }
  };

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

  // Open Full Case View Modal
  const openFullCaseModal = async (caseId) => {
    try {
      setFullCaseLoading(true);
      setFullCaseModalOpen(true);
      setFullCaseTab(0);
      setSelectedCheckTab(0);
      const res = await api.get(`/cases/incident-db/${caseId}/full-details`);
      setFullCaseData(res.data);
    } catch (err) {
      console.error('Failed to fetch full case details:', err);
      setSnackbar({ open: true, message: 'Failed to load case details', severity: 'error' });
      setFullCaseModalOpen(false);
    } finally {
      setFullCaseLoading(false);
    }
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
    if (action === 'reject' && !reviewFeedback) {
      setSnackbar({ open: true, message: "Please provide feedback for the rejection.", severity: 'warning' });
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
                        <Typography
                          onClick={() => openFullCaseModal(row.id)}
                          sx={{
                            fontWeight: 700,
                            fontSize: '14px',
                            color: '#4f46e5',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            '&:hover': { color: '#3730a3' },
                          }}
                          title="Click to view full case details, recordings, documents & evidence"
                        >
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
                                      const isVendorAssigned = Boolean(sub.assigned_vendor_name || sub.assigned_vendor_id);
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
                                            <Tooltip title={!isVendorAssigned ? "Assign vendor to enable this button" : ""} arrow placement="top">
                                              <Box component="span" sx={{ display: 'inline-block', cursor: !isVendorAssigned ? 'not-allowed' : 'default' }}>
                                                {sub.check_status === 'Verified' ? (
                                                  <Button size="small" variant="text" disabled={!isVendorAssigned} onClick={() => openReviewModal(row.id, sub.type)} sx={{ textTransform: 'none', p: 0, minWidth: 'auto', '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'not-allowed' } }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#48bb78', fontSize: '13px', textDecoration: 'underline' }}>Accepted</Typography>
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    size="medium"
                                                    variant="contained"
                                                    disabled={!isVendorAssigned}
                                                    startIcon={<Visibility sx={{ fontSize: 16 }} />}
                                                    onClick={() => openReviewModal(row.id, sub.type)}
                                                    sx={{
                                                      textTransform: 'none',
                                                      fontSize: '13px',
                                                      fontWeight: 700,
                                                      backgroundColor: '#667eea',
                                                      color: '#fff',
                                                      py: 0.75,
                                                      px: 2,
                                                      minWidth: 0,
                                                      boxShadow: 'none',
                                                      mx: 'auto',
                                                      '&.Mui-disabled': {
                                                        pointerEvents: 'auto',
                                                        cursor: 'not-allowed',
                                                        backgroundColor: '#e2e8f0',
                                                        color: '#94a3b8',
                                                      },
                                                    }}
                                                  >
                                                    Review
                                                  </Button>
                                                )}
                                              </Box>
                                            </Tooltip>
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
                          !['id', 'case_id', 'created_at', 'updated_at', 'vendor_evidence', 'evidence', 'evidence_photos', 'statement_audio', 'statement_audio_url', 'statement', 'statement_mr', 'statement_en', 'statement_transcript_updated_at', 'statement_entries', 'statement_transcript_mr', 'statement_transcript_provider', 'statement_transcript_confidence', 'claimant_lat', 'claimant_lng', 'insured_lat', 'insured_lng', 'driver_lat', 'driver_lng', 'spot_lat', 'spot_lng', 'statement_transcript_en', 'statement_audio_path', 'admin_feedback', 'is_reassigned', 'questionnaire'].includes(k)
                        )
                        .map(([key, rawVal], index) => {
                          let val = rawVal;
                          if (typeof rawVal === 'string' && rawVal.startsWith('[') && rawVal.endsWith(']')) {
                            try {
                              val = JSON.parse(rawVal);
                            } catch (e) { }
                          }
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
                                {key.toLowerCase().includes('document') && Array.isArray(val) && val.length > 0 ? (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {val.map((doc, dIdx) => (
                                      <Button
                                        key={dIdx}
                                        size="small"
                                        variant="outlined"
                                        component="a"
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        startIcon={<InsertDriveFile fontSize="small" />}
                                        sx={{ textTransform: 'none', borderRadius: '4px', p: 0.5, px: 1 }}
                                      >
                                        Preview {doc.filename || 'Document'}
                                      </Button>
                                    ))}
                                  </Box>
                                ) : typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/media/')) ? (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    component="a"
                                    href={val}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    startIcon={<InsertDriveFile fontSize="small" />}
                                    sx={{ textTransform: 'none', borderRadius: '4px', p: 0.5, px: 1 }}
                                  >
                                    Preview
                                  </Button>
                                ) : (
                                  displayVal
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </Box>
              </Paper>

              {/* Dedicated Questionnaire Form Section */}
              {(() => {
                const qData = parseQuestionnaire(reviewData?.check?.questionnaire);
                const hasData = qData && typeof qData === 'object' && Object.keys(qData).length > 0;
                const displayObj = hasData
                  ? qData
                  : Object.keys(QUESTIONNAIRE_LABELS).reduce((acc, k) => ({ ...acc, [k]: '—' }), {});

                return (
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📋 Questionnaire Form
                      </Typography>
                      <Chip
                        label={hasData ? "Vendor Submitted" : "Pending Submission"}
                        size="small"
                        sx={{
                          bgcolor: hasData ? '#e0f2fe' : '#f1f5f9',
                          color: hasData ? '#0369a1' : '#64748b',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}
                      />
                    </Box>
                    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <Table size="small" sx={{ minWidth: 400 }}>
                        <TableBody>
                          {Object.entries(displayObj).map(([qKey, qVal], qIdx) => {
                            const label = QUESTIONNAIRE_LABELS[qKey] || qKey.replace(/_/g, ' ');
                            const valStr = qVal != null && qVal !== '' ? String(qVal) : '—';
                            return (
                              <TableRow key={qKey} sx={{ '&:last-child td': { border: 0 }, bgcolor: qIdx % 2 === 0 ? '#f7fafc' : '#ffffff' }}>
                                <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                                  {label}
                                </TableCell>
                                <TableCell sx={{ color: '#2d3748', wordBreak: 'break-word', py: 1.5, whiteSpace: qKey === 'description_of_accident' ? 'pre-wrap' : 'normal' }}>
                                  {valStr}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                  </Paper>
                );
              })()}

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
              {/* Visit Photos Preview */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Visit Photos ({reviewData.check?.evidence_photos?.length || 0})
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
                            alt={photo.filename || `Visit Photo ${pIdx + 1}`}
                            sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block', bgcolor: '#f7fafc' }}
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Image+Error'; }}
                          />
                          <Box sx={{ p: 1, bgcolor: '#fafafa', borderTop: '1px solid #e2e8f0' }}>
                            <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, color: '#4a5568', fontSize: '11px' }}>
                              {photo.filename || `Photo ${pIdx + 1}`}
                            </Typography>
                            {(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date) && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5 }}>
                                🕒 {new Date(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date).toLocaleString()}
                              </Typography>
                            )}
                            {(photo.location_name || photo.location || (photo.latitude != null && photo.longitude != null && photo.latitude !== '' && photo.longitude !== '')) && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                📍 {photo.location_name || photo.location || `${Number(photo.latitude).toFixed(4)}, ${Number(photo.longitude).toFixed(4)}`}
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" sx={{ color: '#a0aec0', fontStyle: 'italic' }}>
                    No visit photos uploaded for this check yet.
                  </Typography>
                )}
              </Paper>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          {reviewAction === 'reject' && (
            <Paper elevation={0} sx={{ p: 2, mb: 1.5, bgcolor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px', width: '100%' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#c53030', mb: 1 }}>
                Provide Rejection / Reassignment Feedback for Vendor
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="Enter specific feedback on why this check is rejected and what the vendor needs to correct or re-verify..."
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                size="small"
                sx={{ bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
              />
            </Paper>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Button onClick={() => setReviewModalOpen(false)} sx={{ textTransform: 'none', color: '#718096' }}>
              Cancel
            </Button>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {reviewAction === 'reject' ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => setReviewAction(null)}
                    sx={{ textTransform: 'none' }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={reviewLoading || !reviewFeedback.trim()}
                    onClick={() => handleReviewSubmit('reject')}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Confirm Rejection &amp; Reassign
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setReviewAction('reject')}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Reject &amp; Reassign
                  </Button>
                  {reviewData?.check?.check_status !== 'Verified' && reviewData?.check?.check_status !== 'Accepted' && (
                    <Button
                      variant="contained"
                      color="success"
                      disabled={reviewLoading}
                      onClick={() => handleReviewSubmit('accept')}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#48bb78', '&:hover': { bgcolor: '#38a169' } }}
                    >
                      Accept Check
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Box>
        </DialogActions>
      </Dialog>

      {/* FULL CASE VIEW MODAL */}
      <Dialog
        open={fullCaseModalOpen}
        onClose={() => setFullCaseModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ bgcolor: '#1e293b', color: '#fff', px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '18px' }}>
              📁 Case Full Details &amp; Evidence — {fullCaseData?.case?.claim_number || 'Case'}
            </Typography>
          </Box>
          <IconButton onClick={() => setFullCaseModalOpen(false)} sx={{ color: '#94a3b8', '&:hover': { color: '#fff' } }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
          {fullCaseLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={40} sx={{ color: '#4f46e5' }} />
            </Box>
          ) : !fullCaseData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <Typography variant="body1" sx={{ color: '#94a3b8' }}>No case data available.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              {/* Navigation Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                  value={fullCaseTab}
                  onChange={(e, val) => setFullCaseTab(val)}
                  sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '14px' } }}
                >
                  <Tab label="General Case Information" />
                  <Tab label={`Verification Checks (${fullCaseData.checks?.length || 0})`} />
                  <Tab label="Media &amp; Evidence Gallery" />
                </Tabs>
              </Box>

              {/* TAB 0: General Case Information */}
              {fullCaseTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                  {/* 4 Rows Format for General Info (Divider separated, no subheadings) */}
                  <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Stack spacing={2.5} divider={<Divider flexItem sx={{ borderColor: '#f1f5f9' }} />}>

                      {/* Row 1: Case Number | Claim Number | Client Name | Client Code */}
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Case Number
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.case_number || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Claim Number
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.claim_number || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Client Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.client_name || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Client Code
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.client_code || '—'}
                          </Typography>
                        </Grid>
                      </Grid>

                      {/* Row 2: Claimant Name | Insured Name | Driver Name */}
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Claimant Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.claimant_name || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Insured Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.insured_name || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Driver Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.driver_name || '—'}
                          </Typography>
                        </Grid>
                      </Grid>

                      {/* Row 3: Category | Case Type | Full Case Status | IR Status | SLA Status */}
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={2.4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Category
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.category || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={2.4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Case Type
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.case_type || '—'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={2.4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Full Case Status
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip label={fullCaseData.case?.full_case_status || '—'} size="small" sx={{ fontWeight: 700, bgcolor: '#eff6ff', color: '#1d4ed8' }} />
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={2.4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            IR Status
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip label={fullCaseData.case?.investigation_report_status || '—'} size="small" sx={{ fontWeight: 700, bgcolor: '#fef3c7', color: '#b45309' }} />
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={2.4}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SLA Status
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip label={fullCaseData.case?.sla || '—'} size="small" sx={{ fontWeight: 700, bgcolor: '#f0fdf4', color: '#15803d' }} />
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Row 4: Case Receive Date | Case Due Date | Case Completion Date | TAT Days */}
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Case Receive Date
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {formatDate(fullCaseData.case?.case_receive_date)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Case Due Date
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {formatDate(fullCaseData.case?.case_due_date)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Case Completion Date
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {formatDate(fullCaseData.case?.completion_date)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            TAT Days
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                            {fullCaseData.case?.tat_days ?? '—'}
                          </Typography>
                        </Grid>
                      </Grid>

                    </Stack>
                  </Paper>

                  {/* Scope of Work */}
                  <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 1.5 }}>
                      🎯 Scope of Work
                    </Typography>
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                        {fullCaseData.case?.scope_of_work || 'No scope of work details specified.'}
                      </Typography>
                    </Box>
                  </Paper>

                  {/* Case Documents */}
                  <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                      📁 Uploaded Case Documents
                    </Typography>
                    <Grid container spacing={2}>
                      {[
                        { title: 'Policy Document', url: fullCaseData.case?.policy_document_url, filename: fullCaseData.case?.policy_document },
                        { title: 'Petition Document', url: fullCaseData.case?.petition_document_url, filename: fullCaseData.case?.petition_document },
                        { title: 'Other Case Document', url: fullCaseData.case?.other_document_url, filename: fullCaseData.case?.other_document },
                      ].map((doc, idx) => (
                        <Grid item xs={12} sm={4} key={idx}>
                          <Box sx={{ p: 2, borderRadius: '8px', border: doc.url ? '1.5px solid #3b82f6' : '1px solid #e2e8f0', bgcolor: doc.url ? '#eff6ff' : '#f8fafc', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: doc.url ? '#1d4ed8' : '#64748b' }}>
                              {doc.title}
                            </Typography>
                            {doc.url ? (
                              Array.isArray(doc.url) ? (
                                doc.url.map((u, i) => (
                                  <Button
                                    key={i}
                                    size="small"
                                    variant="contained"
                                    component="a"
                                    href={u}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    startIcon={<InsertDriveFile />}
                                    sx={{ textTransform: 'none', bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, borderRadius: '6px' }}
                                  >
                                    View Document {i + 1}
                                  </Button>
                                ))
                              ) : (
                                <Button
                                  size="small"
                                  variant="contained"
                                  component="a"
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<InsertDriveFile />}
                                  sx={{ textTransform: 'none', bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, borderRadius: '6px' }}
                                >
                                  View / Download Document
                                </Button>
                              )
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                Not uploaded
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </Box>
              )}

              {/* TAB 1: Verification Checks */}
              {fullCaseTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {fullCaseData.checks && fullCaseData.checks.length > 0 ? (
                    <>
                      {/* Check Sub Tabs */}
                      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs
                          value={selectedCheckTab}
                          onChange={(e, v) => setSelectedCheckTab(v)}
                          variant="scrollable"
                          scrollButtons="auto"
                          sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
                        >
                          {fullCaseData.checks.map((item, cIdx) => (
                            <Tab
                              key={cIdx}
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <span>{item.check_type_label}</span>
                                  <Chip
                                    label={item.check?.check_status || 'Pending'}
                                    size="small"
                                    sx={{
                                      height: '20px',
                                      fontSize: '10px',
                                      bgcolor: item.check?.check_status === 'Verified' || item.check?.check_status === 'Completed' ? '#dcfce7' : '#fef3c7',
                                      color: item.check?.check_status === 'Verified' || item.check?.check_status === 'Completed' ? '#166534' : '#92400e',
                                      fontWeight: 700
                                    }}
                                  />
                                </Box>
                              }
                            />
                          ))}
                        </Tabs>
                      </Box>

                      {/* Selected Check Contents */}
                      {(() => {
                        const currentCheckObj = fullCaseData.checks[selectedCheckTab];
                        if (!currentCheckObj) return null;
                        const checkData = currentCheckObj.check || {};
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Check Status & Vendor Header */}
                            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                  {currentCheckObj.check_type_label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  Assigned Vendor: <strong>{checkData.assigned_vendor_name || 'Unassigned'}</strong>
                                </Typography>
                              </Box>
                              <Chip
                                label={`Status: ${checkData.check_status || 'Not Initiated'}`}
                                sx={{
                                  bgcolor: checkData.check_status === 'Verified' || checkData.check_status === 'Completed' ? '#48bb78' : '#f6ad55',
                                  color: '#fff',
                                  fontWeight: 700,
                                  px: 1
                                }}
                              />
                            </Paper>

                            {/* Verification Data Table */}
                            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4f46e5', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📌 Check Fields &amp; Verification Details
                              </Typography>
                              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                <Table size="small">
                                  <TableBody>
                                    {Object.entries(checkData)
                                      .filter(([k]) => !['id', 'case_id', 'created_at', 'updated_at', 'vendor_evidence', 'evidence', 'evidence_photos', 'statement_audio', 'statement_audio_url', 'statement', 'statement_mr', 'statement_en', 'statement_entries', 'vendor_documents', 'documents', 'assigned_vendor_name', 'questionnaire'].includes(k))
                                      .map(([key, val], idx) => {
                                        const displayVal = val === null || val === undefined || val === '' || val === '[]' || val === '{}'
                                          ? 'N/A'
                                          : Array.isArray(val)
                                            ? val.join(', ')
                                            : typeof val === 'object'
                                              ? JSON.stringify(val)
                                              : String(val);
                                        return (
                                          <TableRow key={key} sx={{ bgcolor: idx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                            <TableCell component="th" sx={{ width: '35%', fontWeight: 600, color: '#475569', textTransform: 'capitalize', borderRight: '1px solid #e2e8f0', py: 1.2 }}>
                                              {key.replace(/_/g, ' ')}
                                            </TableCell>
                                            <TableCell sx={{ color: '#0f172a', fontWeight: 500, py: 1.2, wordBreak: 'break-word' }}>
                                              {displayVal}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Paper>

                            {/* Dedicated Questionnaire Form Section */}
                            {(() => {
                              const qData = parseQuestionnaire(checkData?.questionnaire);
                              const hasData = qData && typeof qData === 'object' && Object.keys(qData).length > 0;
                              const displayObj = hasData
                                ? qData
                                : Object.keys(QUESTIONNAIRE_LABELS).reduce((acc, k) => ({ ...acc, [k]: '—' }), {});

                              return (
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      📋 Questionnaire Form Details
                                    </Typography>
                                    <Chip
                                      label={hasData ? "Vendor Submitted" : "Pending Submission"}
                                      size="small"
                                      sx={{
                                        bgcolor: hasData ? '#e0f2fe' : '#f1f5f9',
                                        color: hasData ? '#0369a1' : '#64748b',
                                        fontWeight: 700,
                                        fontSize: '11px'
                                      }}
                                    />
                                  </Box>
                                  <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                    <Table size="small">
                                      <TableBody>
                                        {Object.entries(displayObj).map(([qKey, qVal], qIdx) => {
                                          const label = QUESTIONNAIRE_LABELS[qKey] || qKey.replace(/_/g, ' ');
                                          const valStr = qVal != null && qVal !== '' ? String(qVal) : '—';
                                          return (
                                            <TableRow key={qKey} sx={{ bgcolor: qIdx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                              <TableCell component="th" sx={{ width: '35%', fontWeight: 600, color: '#475569', textTransform: 'capitalize', borderRight: '1px solid #e2e8f0', py: 1.2 }}>
                                                {label}
                                              </TableCell>
                                              <TableCell sx={{ color: '#0f172a', fontWeight: 500, py: 1.2, wordBreak: 'break-word', whiteSpace: qKey === 'description_of_accident' ? 'pre-wrap' : 'normal' }}>
                                                {valStr}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </Box>
                                </Paper>
                              );
                            })()}

                            {/* Statements & Audio Recordings */}
                            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4f46e5', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                🎙️ Statements &amp; Audio Recordings
                              </Typography>
                              {checkData.statement_entries && checkData.statement_entries.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {checkData.statement_entries.map((st, sIdx) => (
                                    <Paper key={sIdx} elevation={0} sx={{ p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                                        Statement {st.index || sIdx + 1}
                                      </Typography>
                                      {st.audio_url && (
                                        <Box sx={{ mb: 1 }}>
                                          <audio controls src={st.audio_url} style={{ width: '100%', height: '36px' }} />
                                        </Box>
                                      )}
                                      <Typography variant="body2" sx={{ color: '#334155', whiteSpace: 'pre-line' }}>
                                        {st.translation_en || st.statement_text || 'No statement text.'}
                                      </Typography>
                                    </Paper>
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                  No statement audio recordings stored.
                                </Typography>
                              )}

                              {checkData.statement_en && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                                    Additional Statement Details:
                                  </Typography>
                                  <Paper elevation={0} sx={{ p: 2, mt: 0.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <Typography variant="body2" sx={{ color: '#1e293b', whiteSpace: 'pre-line' }}>
                                      {checkData.statement_en}
                                    </Typography>
                                  </Paper>
                                </Box>
                              )}
                            </Paper>

                            {/* Visit Photos */}
                            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4f46e5', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📷 Visit Photos ({checkData.evidence_photos?.length || 0})
                              </Typography>
                              {checkData.evidence_photos && checkData.evidence_photos.length > 0 ? (
                                <Grid container spacing={2}>
                                  {checkData.evidence_photos.map((photo, pIdx) => (
                                    <Grid item xs={6} sm={4} md={3} key={pIdx}>
                                      <Paper
                                        elevation={0}
                                        onClick={() => setActivePhotoPreview(photo.url)}
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
                                          src={photo.url}
                                          alt={photo.filename || `Visit Photo ${pIdx + 1}`}
                                          sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', bgcolor: '#f8fafc' }}
                                        />
                                        <Box sx={{ p: 1, bgcolor: '#fafafa', borderTop: '1px solid #e2e8f0' }}>
                                          <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, color: '#334155' }}>
                                            {photo.filename || `Photo ${pIdx + 1}`}
                                          </Typography>
                                          {(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date) && (
                                            <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5 }}>
                                              🕒 {new Date(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date).toLocaleString()}
                                            </Typography>
                                          )}
                                          {(photo.location_name || photo.location || (photo.latitude != null && photo.longitude != null && photo.latitude !== '' && photo.longitude !== '')) && (
                                            <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                              📍 {photo.location_name || photo.location || `${Number(photo.latitude).toFixed(4)}, ${Number(photo.longitude).toFixed(4)}`}
                                            </Typography>
                                          )}
                                        </Box>
                                      </Paper>
                                    </Grid>
                                  ))}
                                </Grid>
                              ) : (
                                <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                  No visit photos uploaded for this check.
                                </Typography>
                              )}
                            </Paper>
                          </Box>
                        );
                      })()}
                    </>
                  ) : (
                    <Typography variant="body1" sx={{ color: '#94a3b8', textAlign: 'center', py: 4 }}>
                      No verification checks recorded for this case yet.
                    </Typography>
                  )}
                </Box>
              )}

              {/* TAB 2: Media & Evidence Gallery */}
              {fullCaseTab === 2 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                      📸 All Visit Photos Across Checks
                    </Typography>
                    {(() => {
                      const allPhotos = [];
                      fullCaseData.checks?.forEach(item => {
                        item.check?.evidence_photos?.forEach(photo => {
                          allPhotos.push({ ...photo, checkType: item.check_type_label });
                        });
                      });

                      if (allPhotos.length === 0) {
                        return (
                          <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            No visit photos found across any checks.
                          </Typography>
                        );
                      }

                      return (
                        <Grid container spacing={2}>
                          {allPhotos.map((photo, i) => (
                            <Grid item xs={6} sm={4} md={3} key={i}>
                              <Paper
                                elevation={0}
                                onClick={() => setActivePhotoPreview(photo.url)}
                                sx={{
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '10px',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  '&:hover': { transform: 'scale(1.02)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                                }}
                              >
                                <Box
                                  component="img"
                                  src={photo.url}
                                  sx={{ width: '100%', height: 160, objectFit: 'cover' }}
                                />
                                <Box sx={{ p: 1, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                  <Chip label={photo.checkType} size="small" sx={{ fontSize: '10px', height: '18px', mb: 0.5, bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 700 }} />
                                  <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, color: '#334155' }}>
                                    {photo.filename || `Photo ${i + 1}`}
                                  </Typography>
                                  {(photo.timestamp || photo.created_at || photo.uploaded_at) && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5 }}>
                                      🕒 {new Date(photo.timestamp || photo.created_at || photo.uploaded_at).toLocaleString()}
                                    </Typography>
                                  )}
                                  {(photo.location_name || (photo.latitude != null && photo.longitude != null && photo.latitude !== '' && photo.longitude !== '')) && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                      📍 {photo.location_name || `${Number(photo.latitude).toFixed(4)}, ${Number(photo.longitude).toFixed(4)}`}
                                    </Typography>
                                  )}
                                </Box>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      );
                    })()}
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setFullCaseModalOpen(false)} variant="outlined" sx={{ textTransform: 'none', borderRadius: '8px', px: 3, color: '#64748b', borderColor: '#cbd5e1' }}>
            Cancel
          </Button>
          {fullCaseData?.case?.full_case_status === 'Completed' ? (
            <Button
              onClick={() => {
                setStatusConfirmAction('WIP');
                setStatusConfirmOpen(true);
              }}
              variant="contained"
              disabled={statusLoading}
              sx={{ textTransform: 'none', bgcolor: '#48bb78', '&:hover': { bgcolor: '#38a169' }, borderRadius: '8px', px: 3 }}
            >
              {statusLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Open Case'}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setStatusConfirmAction('Completed');
                setStatusConfirmOpen(true);
              }}
              variant="contained"
              disabled={statusLoading}
              sx={{ textTransform: 'none', bgcolor: '#e53e3e', '&:hover': { bgcolor: '#c53030' }, borderRadius: '8px', px: 3 }}
            >
              {statusLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Close Case'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Case Status Change */}
      <Dialog open={statusConfirmOpen} onClose={() => setStatusConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Status Change</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: '#475569' }}>
            Are you sure you want to {statusConfirmAction === 'Completed' ? 'close' : 'open'} this case?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setStatusConfirmOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
          <Button
            onClick={() => {
              handleToggleCaseStatus(fullCaseData.case.id, statusConfirmAction);
              setStatusConfirmOpen(false);
            }}
            variant="contained"
            color={statusConfirmAction === 'Completed' ? 'error' : 'success'}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Check Accept */}
      <Dialog open={confirmAcceptOpen} onClose={() => setConfirmAcceptOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Acceptance</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: '#475569' }}>
            Are you sure you want to accept this check?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmAcceptOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
          <Button
            onClick={() => handleReviewSubmit('accept')}
            variant="contained"
            color="success"
            disabled={reviewLoading}
          >
            {reviewLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Confirm Accept'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Check Reject */}
      <Dialog open={confirmRejectOpen} onClose={() => setConfirmRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Rejection</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: '#475569' }}>
            Are you sure you want to reject and reassign this check?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmRejectOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
          <Button
            onClick={() => handleReviewSubmit('reject')}
            variant="contained"
            color="error"
            disabled={reviewLoading}
          >
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
