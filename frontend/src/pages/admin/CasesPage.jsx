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
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
import api from '../../services/api';

// Full case status colors (incident_case_db values)
const fullCaseStatusColors = {
  'WIP':                    '#f6ad55',
  'Pending CS':             '#ed8936',
  'Completed':              '#48bb78',
  'IR-Writing':             '#4299e1',
  'NI':                     '#a0aec0',
  'Withdraw':               '#f56565',
  'QC-1':                   '#9f7aea',
  'Pending Additional Docs':'#ed8936',
  'Connected Pending':      '#b794f4',
  'RCU Pending':            '#76e4f7',
  'Portal Upload':          '#667eea',
};

// Investigation report status colors
const irStatusColors = {
  'Open':     '#4299e1',
  'Approval': '#f6ad55',
  'Stop':     '#f56565',
  'QC':       '#9f7aea',
  'Dispatch': '#48bb78',
};

// Verification check_status colors
const checkStatusColors = {
  'Not Initiated': '#a0aec0',
  'WIP':           '#f6ad55',
  'Completed':     '#48bb78',
  'Stop':          '#f56565',
};

// Case type chip colors
const caseTypeColors = {
  'Full Case':       '#667eea',
  'Partial Case':    '#9f7aea',
  'Reassessment':    '#4299e1',
  'Connected Case':  '#76e4f7',
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
  const [assigningVendor, setAssigningVendor] = useState(null);
  const [expandedCases, setExpandedCases] = useState({});

  // Vendor assignment modal state
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorList, setVendorList] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorAssigning, setVendorAssigning] = useState(false);
  const [vendorModalTarget, setVendorModalTarget] = useState(null); // { caseId, checkType }

  // Delete case modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, fullCaseStatusFilter, caseTypeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);

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

  // Auto-assign vendor function
  const handleAutoAssignVendor = async (caseId) => {
    try {
      setAssigningVendor(caseId);
      const response = await api.post(`/cases/${caseId}/auto-assign-vendor`);
      
      if (response.data.success) {
        // Refresh the cases list to show the updated vendor assignment
        await fetchData();
        alert(`Vendor assigned successfully: ${response.data.assigned_vendor.company_name} (${response.data.assigned_vendor.distance_km} km away)`);
      } else {
        alert(`Error: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Failed to auto-assign vendor:', error);
      alert('Failed to assign vendor. Please try again.');
    } finally {
      setAssigningVendor(null);
    }
  };

  // Open vendor assignment modal for a sub-check
  const openVendorModal = async (caseId, checkType) => {
    setVendorModalTarget({ caseId, checkType });
    setSelectedVendorId('');
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
    if (!vendorModalTarget || !selectedVendorId) return;
    const { caseId, checkType } = vendorModalTarget;
    const typeToSlug = {
      'Claimant Check': 'claimant',
      'Insured Check': 'insured',
      'Driver Check': 'driver',
      'Spot Check': 'spot',
      'Chargesheet': 'chargesheet',
      'RTI Check': 'rti',
      'RTO Check': 'rto',
    };
    const slug = typeToSlug[checkType] || checkType;
    try {
      setVendorAssigning(true);
      await api.post(`/cases/incident-db/${caseId}/check/${slug}/assign-vendor`, {
        vendor_id: parseInt(selectedVendorId, 10),
      });
      setVendorModalOpen(false);
      setVendorModalTarget(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to assign vendor:', err);
      alert('Failed to assign vendor. Please try again.');
    } finally {
      setVendorAssigning(false);
    }
  };

  // Delete case handler
  const handleDeleteCase = async () => {
    if (!caseToDelete) return;
    try {
      setDeleting(true);
      await api.delete(`/cases/incident-db/${caseToDelete.id}`);
      setDeleteDialogOpen(false);
      setCaseToDelete(null);
      alert(`Case ${caseToDelete.case_number} deleted successfully.`);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete case:', error);
      alert(error.response?.data?.detail || error.response?.data?.error || 'Failed to delete case. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (caseData) => {
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
    return String(rawName).replace(/\s*[\u2013\-]\s*[A-Za-z0-9]+\s*$/, '').trim() || rawName;
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

            {/* New Case Button */}
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateCase}
              sx={{
                ml: 'auto',
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
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < cases.length}
                    checked={cases.length > 0 && selected.length === cases.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', width: 40 }}></TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', width: 50 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Case Number</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Claim Number</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Client Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Case Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Case Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>IR Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>SLA</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>TAT Days</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Last Updated</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', width: 80, textAlign: 'center' }}>Actions</TableCell>
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
                      sx={{ '&:last-child td': { border: 0 }, cursor: 'pointer' }}
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
                        <Typography sx={{ color: '#667eea', fontWeight: 700, fontSize: '14px' }}>
                          {row.seq_num}
                        </Typography>
                      </TableCell>

                      {/* Case Number */}
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '13px', color: '#764ba2' }}>
                          {row.case_number || '—'}
                        </Typography>
                      </TableCell>

                      {/* Claim Number */}
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                          {row.claim_number || '—'}
                        </Typography>
                      </TableCell>

                      {/* Client Name */}
                      <TableCell>
                        <Typography sx={{ fontSize: '14px' }}>{displayClientName(row.client_name)}</Typography>
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
                            fontSize: '11px',
                            height: '22px',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <Typography sx={{ fontSize: '14px' }}>{row.category || '—'}</Typography>
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
                            fontSize: '11px',
                            height: '22px',
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
                            fontSize: '11px',
                            height: '22px',
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
                              fontSize: '11px',
                              height: '22px',
                              borderRadius: '6px',
                            }}
                          />
                        ) : <Typography sx={{ fontSize: '13px', color: '#aaa' }}>—</Typography>}
                      </TableCell>

                      {/* TAT Days */}
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', textAlign: 'center' }}>
                          {row.tat_days ?? '—'}
                        </Typography>
                      </TableCell>

                      {/* Last Updated */}
                      <TableCell>
                        <Typography sx={{ fontSize: '13px', color: '#666' }}>
                          {formatDate(row.updated_at)}
                        </Typography>
                      </TableCell>

                      {/* Actions */}
                      <TableCell sx={{ textAlign: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => openDeleteDialog(row)}
                          sx={{
                            color: '#f56565',
                            '&:hover': { backgroundColor: '#ffe0e0' },
                          }}
                          title="Delete case"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    {/* ── Sub-items (verification checks) ── */}
                    {subItems.length > 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={14}
                          sx={{ py: 0, borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none', p: 0 }}
                        >
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ backgroundColor: '#f5f7ff', borderLeft: '4px solid #667eea' }}>
                              {/* Sub-table header */}
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: '70px 130px 1fr 1fr 1fr 100px 1.2fr 150px',
                                  px: 2,
                                  py: 0.75,
                                  backgroundColor: '#eef0fb',
                                  borderBottom: '1px solid #d0d5f5',
                                }}
                              >
                                {['Sub ID', 'Type', 'Name / Subject', 'Contact', 'Location', 'Status', 'Statement / Brief', 'Assigned Vendor'].map((h) => (
                                  <Typography key={h} sx={{ fontSize: '11px', fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    {h}
                                  </Typography>
                                ))}
                              </Box>

                              {/* Sub-table rows */}
                              {subItems.map((sub, idx) => {
                                const sc = checkStatusColors[sub.check_status] || '#a0aec0';
                                const typeToSlug = {
                                  'Claimant Check': 'claimant',
                                  'Insured Check': 'insured',
                                  'Driver Check': 'driver',
                                  'Spot Check': 'spot',
                                  'Chargesheet': 'chargesheet',
                                  'RTI Check': 'rti',
                                  'RTO Check': 'rto',
                                };
                                return (
                                  <Box
                                    key={sub.sub_id}
                                    onClick={() => {
                                      const slug = typeToSlug[sub.type];
                                      if (slug) navigate(`/admin/cases/${row.id}/check/${slug}`);
                                    }}
                                    sx={{
                                      display: 'grid',
                                      gridTemplateColumns: '70px 130px 1fr 1fr 1fr 100px 1.2fr 150px',
                                      px: 2,
                                      py: 0.9,
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f9faff',
                                      borderBottom: idx < subItems.length - 1 ? '1px solid #eceef8' : 'none',
                                      '&:hover': { backgroundColor: '#e8eaff' },
                                    }}
                                  >
                                    <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#667eea' }}>
                                      {sub.sub_id}
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#444' }}>
                                      {sub.type}
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#333' }} noWrap title={sub.name}>
                                      {sub.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#555' }} noWrap title={sub.contact}>
                                      {sub.contact}
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#555' }} noWrap title={sub.location}>
                                      {sub.location}
                                    </Typography>
                                    <Box>
                                      <Chip
                                        label={sub.check_status}
                                        size="small"
                                        sx={{
                                          backgroundColor: `${sc}22`,
                                          color: sc,
                                          fontWeight: 700,
                                          fontSize: '11px',
                                          height: '20px',
                                          borderRadius: '5px',
                                        }}
                                      />
                                    </Box>
                                    <Typography sx={{ fontSize: '11px', color: '#777', fontStyle: sub.statement ? 'normal' : 'italic' }} noWrap title={sub.statement}>
                                      {sub.statement || '—'}
                                    </Typography>
                                    <Box onClick={(e) => e.stopPropagation()}>
                                      {sub.assigned_vendor_name ? (
                                        <Chip
                                          label={sub.assigned_vendor_name}
                                          size="small"
                                          sx={{
                                            backgroundColor: '#e8f5e920',
                                            color: '#2e7d32',
                                            fontWeight: 600,
                                            fontSize: '11px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            maxWidth: '140px',
                                          }}
                                          title={sub.assigned_vendor_name}
                                        />
                                      ) : (
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          onClick={() => openVendorModal(row.id, sub.type)}
                                          sx={{
                                            textTransform: 'none',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            borderColor: '#667eea',
                                            color: '#667eea',
                                            borderRadius: '6px',
                                            py: 0,
                                            px: 1.5,
                                            minWidth: 'auto',
                                            '&:hover': { backgroundColor: '#f0f4ff', borderColor: '#5568d3' },
                                          }}
                                        >
                                          Assign
                                        </Button>
                                      )}
                                    </Box>
                                  </Box>
                                );
                              })}
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
                  <TableCell colSpan={14} sx={{ textAlign: 'center', py: 4 }}>
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
          Assign Vendor
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: '#666', mb: 2 }}>
            Select a vendor to assign to this check.
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              displayEmpty
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="" disabled>Select a vendor</MenuItem>
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
            disabled={!selectedVendorId || vendorAssigning}
            onClick={handleAssignVendorToCheck}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#667eea',
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#5568d3' },
            }}
          >
            {vendorAssigning ? <CircularProgress size={20} color="inherit" /> : 'Assign'}
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
          Delete Case
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#666', mb: 2 }}>
            Are you sure you want to delete case <strong>{caseToDelete?.case_number}</strong>?
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#999' }}>
            This action will permanently delete the case and all its related verification checks. This cannot be undone.
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
    </AdminLayout>
  );
};

export default CasesPage;
