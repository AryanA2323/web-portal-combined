import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
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
  TablePagination,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Description,
  Schedule,
  CheckCircle,
  Cancel,
  ChevronRight,
  History,
  Gavel,
  Assignment,
  InsertDriveFile,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import StatCard from './components/StatCard';
import api from '../../services/api';
import { NotificationBell } from '../../components/case_manager';
import { getEvidencePhotoUrl, resolveEvidencePhotoUrl } from '../../utils/mediaUrls';
import AlertMessage from '../../components/common/AlertMessage';

const formatEvidenceTimestamp = (photo) => {
  const rawValue = photo?.captured_at || photo?.uploaded_at || photo?.timestamp;
  if (!rawValue) return '';

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return String(rawValue);

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).replace(',', '');
};

const getEvidenceWatermarkLines = (photo) => {
  const locationName = typeof photo?.location_name === 'string' ? photo.location_name.trim() : '';
  const timestamp = formatEvidenceTimestamp(photo);
  return [locationName, timestamp].filter(Boolean);
};

const getStatusDisplayLabel = (status) => {
  if (status === 'ACCEPTED') return 'APPROVED';
  return status;
};

const LegalReviewPage = () => {
  // State for data
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    accepted: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);

  // QC assignment modal state
  const [qcModalOpen, setQCModalOpen] = useState(false);
  const [qcs, setQCs] = useState([]);
  const [selectedQCId, setSelectedQCId] = useState('');
  const [assigningQC, setAssigningQC] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [qcModalMode, setQCModalMode] = useState('assign');
  const [qcsLoading, setQCsLoading] = useState(false);
  const [qcsError, setQCsError] = useState(null);

  // Report detail modal state
  const [reportDetailOpen, setReportDetailOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [editableReportContent, setEditableReportContent] = useState('');
  const [savingReportContent, setSavingReportContent] = useState(false);
  const [reportContentError, setReportContentError] = useState(null);

  // Fetch reports and stats
  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const [reportsRes, statsRes] = await Promise.all([
        api.get(`/reports${statusParam}`),
        api.get('/reports/stats'),
      ]);
      setReports(reportsRes.data || []);
      setStats(statsRes.data || { total: 0, pending: 0, assigned: 0, accepted: 0, rejected: 0 });
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Open qc assignment modal
  const openQCModal = async (reportId, mode = 'assign') => {
    setSelectedReportId(reportId);
    setQCModalMode(mode);
    setSelectedQCId('');
    setQCsLoading(true);
    setQCsError(null);
    setQCModalOpen(true);
    try {
      const res = await api.get('/qcs');
      setQCs(res.data || []);
      if (!res.data || res.data.length === 0) {
        setQCsError('No qcs found in the system.');
      }
    } catch (err) {
      console.error('Failed to fetch qcs:', err);
      setQCsError(err.response?.data?.detail || err.message || 'Failed to load qcs');
      setQCs([]);
    } finally {
      setQCsLoading(false);
    }
  };

  // Handle qc assignment
  const handleAssignQC = async () => {
    if (!selectedReportId || !selectedQCId) return;
    setAssigningQC(true);
    try {
      const endpoint = qcModalMode === 'reassign'
        ? `/reports/${selectedReportId}/reassign`
        : `/reports/${selectedReportId}/assign`;
      const res = await api.post(endpoint, {
        qc_id: selectedQCId,
      });
      if (selectedReport?.id === selectedReportId) {
        setSelectedReport(res.data);
        setEditableReportContent(res.data?.report_content || '');
      }
      setQCModalOpen(false);
      setSelectedReportId(null);
      setQCModalMode('assign');
      await fetchReports();
    } catch (err) {
      console.error('Failed to assign qc:', err);
      alert(`Failed to ${qcModalMode === 'reassign' ? 'reassign' : 'assign'} qc. Please try again.`);
    } finally {
      setAssigningQC(false);
    }
  };

  // Open report detail modal
  const openReportDetail = async (reportId) => {
    try {
      const res = await api.get(`/reports/${reportId}`);
      setSelectedReport(res.data);
      setEditableReportContent(res.data?.report_content || '');
      setReportContentError(null);
      setReportDetailOpen(true);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      alert('Failed to load report details.');
    }
  };

  const handleCloseReportDetail = () => {
    setReportDetailOpen(false);
    setSelectedReport(null);
    setEditableReportContent('');
    setReportContentError(null);
    setSavingReportContent(false);
  };

  const handleSaveReportContent = async () => {
    if (!selectedReport || selectedReport.status !== 'REJECTED' || savingReportContent) return;

    setSavingReportContent(true);
    setReportContentError(null);

    try {
      const res = await api.put(`/reports/${selectedReport.id}/content`, {
        report_content: editableReportContent,
      });

      setSelectedReport(res.data);
      setEditableReportContent(res.data?.report_content || '');
      await fetchReports();
    } catch (err) {
      console.error('Failed to update report content:', err);
      setReportContentError(err.response?.data?.detail || 'Failed to save report changes.');
    } finally {
      setSavingReportContent(false);
    }
  };

  // Select handlers
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = reports.map((n) => n.id);
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

  const handleClearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  // Helper functions
  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return '#ff922b';
      case 'ASSIGNED':
        return '#4dabf7';
      case 'ACCEPTED':
        return '#51cf66';
      case 'REJECTED':
        return '#ff6b6b';
      default:
        return '#868e96';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <Schedule sx={{ fontSize: 16 }} />;
      case 'ASSIGNED':
        return <Assignment sx={{ fontSize: 16 }} />;
      case 'ACCEPTED':
        return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'REJECTED':
        return <Cancel sx={{ fontSize: 16 }} />;
      default:
        return <Schedule sx={{ fontSize: 16 }} />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Stats data for cards
  const statsData = [
    {
      title: 'Total Reports',
      value: stats.total,
      icon: Description,
      iconBgColor: '#e3f2fd',
    },
    {
      title: 'Pending Review',
      value: stats.pending + stats.assigned,
      icon: Schedule,
      iconBgColor: '#fff3e0',
    },
    {
      title: 'Approved Reports',
      value: stats.accepted,
      icon: CheckCircle,
      iconBgColor: '#e8f5e9',
    },
    {
      title: 'Rejected Reports',
      value: stats.rejected,
      icon: Cancel,
      iconBgColor: '#ffebee',
    },
  ];

  // Filter reports by category (client-side since we don't have backend filter for this)
  const filteredReports = reports.filter((report) => {
    if (categoryFilter !== 'all' && report.category !== categoryFilter) return false;
    return true;
  });

  const paginatedReports = filteredReports.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <CaseManagerLayout disablePadding>
      {/* Top Header Section - Legal Review Theme */}
      <Box
        sx={{
          minHeight: 110,
          py: 1.75,
          mx: { xs: 1.5, md: 2.5 },
          px: { xs: 2, md: 3 },
          borderRadius: '0 0 16px 16px',
          boxSizing: 'border-box',
          background: 'linear-gradient(120deg, #fefce8 0%, #fef3c7 25%, #e0f2fe 65%, #e0e7ff 100%)',
          boxShadow: '0 4px 16px rgba(148, 163, 184, 0.08)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderTop: 'none',
        }}
      >
        {/* Multi-Tone Ambient Glowing Mesh Accents */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 10% 20%, rgba(245, 158, 11, 0.18) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.20) 0%, transparent 40%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Left Side: Title & Gavel Icon */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.18)',
            }}
          >
            <Gavel sx={{ fontSize: 26, color: '#b45309' }} />
          </Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.5rem', md: '1.9rem' },
              letterSpacing: '-0.8px',
              background: 'linear-gradient(135deg, #0f172a 0%, #78350f 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            Legal Review
          </Typography>
        </Box>

        {/* Right Side: 4 Stat Cards in Single Row + Notification Bell */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-end' }}>
          {/* Single Row of 4 Stat Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1.25,
              flex: 1,
              maxWidth: 440,
            }}
          >
            {statsData.map((stat, index) => (
              <Box key={index} sx={{ minWidth: 0 }}>
                <StatCard {...stat} compact={true} hideIcon={true} />
              </Box>
            ))}
          </Box>

          {/* Notification Bell */}
          <Box
            sx={{
              bgcolor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.12)',
              p: 0.5,
              flexShrink: 0,
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.2)',
                transform: 'scale(1.03)',
              },
            }}
          >
            <NotificationBell />
          </Box>
        </Box>
      </Box>

      {/* Main Content Container */}
      <Box sx={{ p: 3, pt: 1 }}>

      {error && (
        <AlertMessage severity="error" onClose={() => setError(null)} message={error} open={!!error} />
      )}

      {/* Main Content */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          overflow: 'hidden',
        }}
      >
        {/* Filters */}
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#333' }}>
              Legal Review Queue
            </Typography>

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="assigned">Assigned</MenuItem>
                <MenuItem value="accepted">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>

            {/* Category Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Categories</MenuItem>
                <MenuItem value="MOTOR">Motor</MenuItem>
                <MenuItem value="NON_MOTOR">Non-Motor</MenuItem>
                <MenuItem value="HEALTH">Health</MenuItem>
                <MenuItem value="PROPERTY">Property</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </Select>
            </FormControl>

            {/* Clear Filters */}
            <Button
              variant="text"
              size="small"
              onClick={handleClearFilters}
              sx={{
                color: '#667eea',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#f0f4ff' },
              }}
            >
              Clear Filters
            </Button>

            {/* Reviewed History Button */}
            <Button
              variant="contained"
              startIcon={<History />}
              onClick={() => setStatusFilter('accepted')}
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
              Reviewed History
            </Button>
          </Box>
        </Box>

        {/* Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredReports.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: '#666' }}>
            <Description sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography>No reports found</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < filteredReports.length}
                      checked={filteredReports.length > 0 && selected.length === filteredReports.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                    Case Number
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                    Case Title
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                    Client
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                    Assigned QC
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                    Created
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedReports.map((row) => {
                  const isItemSelected = isSelected(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        '&:last-child td': { border: 0 },
                        cursor: 'pointer',
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isItemSelected}
                          onChange={() => handleSelect(row.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            color: '#667eea',
                            fontWeight: 600,
                            fontSize: '14px',
                          }}
                        >
                          {row.case_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', color: '#333', maxWidth: 300 }} noWrap>
                          {row.case_title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', color: '#333' }}>
                          {row.client_name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.assigned_qc_name ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: '12px',
                                backgroundColor: '#667eea',
                              }}
                            >
                              <Gavel sx={{ fontSize: 16 }} />
                            </Avatar>
                            <Typography sx={{ fontSize: '14px', color: '#333' }}>
                              {row.assigned_qc_name}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: '14px', color: '#999' }}>
                            Not assigned
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', color: '#666' }}>
                          {formatDate(row.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(row.status)}
                          label={getStatusDisplayLabel(row.status)}
                          size="small"
                          sx={{
                            backgroundColor: `${getStatusColor(row.status)}15`,
                            color: getStatusColor(row.status),
                            fontWeight: 500,
                            fontSize: '12px',
                            height: '26px',
                            borderRadius: '6px',
                            '& .MuiChip-icon': {
                              color: getStatusColor(row.status),
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => openReportDetail(row.id)}
                            sx={{
                              backgroundColor: '#667eea',
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '13px',
                              borderRadius: '6px',
                              minWidth: '70px',
                              '&:hover': { backgroundColor: '#5568d3' },
                            }}
                          >
                            Review
                          </Button>
                          {(row.status === 'PENDING' || row.status === 'ASSIGNED') && (
                            <Button
                              variant="outlined"
                              size="small"
                              endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
                              onClick={() => openQCModal(row.id)}
                              sx={{
                                textTransform: 'none',
                                borderColor: '#e0e0e0',
                                color: '#333',
                                fontWeight: 500,
                                fontSize: '13px',
                                borderRadius: '6px',
                                '&:hover': {
                                  borderColor: '#667eea',
                                  backgroundColor: '#f0f4ff',
                                },
                              }}
                            >
                              {row.assigned_qc_name ? 'Reassign' : 'Assign QC'}
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <Typography sx={{ fontSize: '14px', color: '#666' }}>
            {filteredReports.length > 0
              ? `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, filteredReports.length)} of ${filteredReports.length}`
              : '0 reports'}
          </Typography>
          <TablePagination
            component="div"
            count={filteredReports.length}
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

      {/* QC Assignment Modal */}
      <Dialog
        open={qcModalOpen}
        onClose={() => setQCModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1 }}>
          {qcModalMode === 'reassign' ? 'Reassign QC' : 'Assign QC'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: '#666', mb: 2 }}>
            {qcModalMode === 'reassign'
              ? 'Select a qc to reassign this updated report for legal review.'
              : 'Select a qc to assign for legal review of this report.'}
          </Typography>
          {qcsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : qcsError ? (
            <AlertMessage severity="error" message={qcsError} open={!!qcsError} />
          ) : (
            <FormControl fullWidth size="small">
              <Select
                value={selectedQCId}
                onChange={(e) => setSelectedQCId(e.target.value)}
                displayEmpty
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="" disabled>Select a qc</MenuItem>
                {qcs.map((qc) => (
                  <MenuItem key={qc.id} value={qc.id}>
                    {qc.full_name || qc.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {!qcsLoading && !qcsError && qcs.length === 0 && (
            <Typography sx={{ fontSize: '13px', color: '#ff6b6b', mt: 1 }}>
              No qcs available. Please add qcs to the system first.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setQCModalOpen(false);
              setQCModalMode('assign');
            }}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!selectedQCId || assigningQC}
            onClick={handleAssignQC}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#667eea',
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#5568d3' },
            }}
          >
            {assigningQC ? <CircularProgress size={20} color="inherit" /> : qcModalMode === 'reassign' ? 'Reassign' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Detail Modal */}
      <Dialog
        open={reportDetailOpen}
        onClose={handleCloseReportDetail}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description />
          Report Details - {selectedReport?.case_number}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`Status: ${getStatusDisplayLabel(selectedReport.status)}`}
                  sx={{
                    backgroundColor: `${getStatusColor(selectedReport.status)}15`,
                    color: getStatusColor(selectedReport.status),
                    fontWeight: 600,
                  }}
                />
                {selectedReport.assigned_qc_name && (
                  <Chip
                    icon={<Gavel />}
                    label={`Assigned: ${selectedReport.assigned_qc_name}`}
                    sx={{ backgroundColor: '#e3f2fd', color: '#1976d2' }}
                  />
                )}
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Case: {selectedReport.case_title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Client: {selectedReport.client_name || 'N/A'} | Category: {selectedReport.category}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                AI Generated Report:
              </Typography>
              {selectedReport.status === 'REJECTED' ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={12}
                  value={editableReportContent}
                  onChange={(e) => setEditableReportContent(e.target.value)}
                  error={Boolean(reportContentError)}
                  helperText={reportContentError || 'Rejected reports can be edited and saved from this modal.'}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      alignItems: 'flex-start',
                      borderRadius: '8px',
                      backgroundColor: '#f8f9fa',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                    },
                    '& .MuiInputBase-inputMultiline': {
                      fontFamily: 'monospace',
                      fontSize: '13px',
                    },
                  }}
                />
              ) : (
                <Box
                  sx={{
                    borderRadius: '10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    p: 2.5,
                  }}
                >
                  <Typography
                    component="pre"
                    sx={{
                      m: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      lineHeight: 1.7,
                      color: '#1e293b',
                    }}
                  >
                    {selectedReport.report_content}
                  </Typography>
                </Box>
              )}

              {selectedReport.evidence_photos && selectedReport.evidence_photos.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Vendor Evidence
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 2,
                      maxHeight: '500px',
                      overflowY: 'auto',
                    }}
                  >
                    {selectedReport.evidence_photos.map((photo, idx) => {
                      const photoUrl = getEvidencePhotoUrl(photo);
                      const watermarkLines = getEvidenceWatermarkLines(photo);

                      return (
                        <Box
                          key={`legal-evidence-${idx}`}
                          sx={{
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                          }}
                        >
                          <Box sx={{ position: 'relative', backgroundColor: '#0f172a' }}>
                            <img
                              src={resolveEvidencePhotoUrl(photoUrl)}
                              alt={`Vendor Evidence ${idx + 1}`}
                              style={{
                                display: 'block',
                                width: '100%',
                                height: '250px',
                                objectFit: 'cover',
                              }}
                            />
                            {watermarkLines.length > 0 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  px: 1.5,
                                  py: 1,
                                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.86) 48%, rgba(15, 23, 42, 0.96) 100%)',
                                }}
                              >
                                {watermarkLines.map((line, lineIndex) => (
                                  <Typography
                                    key={`legal-watermark-${idx}-${lineIndex}`}
                                    sx={{
                                      fontSize: '12px',
                                      lineHeight: 1.35,
                                      color: '#ffffff',
                                      fontWeight: 600,
                                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {line}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {selectedReport.vendor_documents && selectedReport.vendor_documents.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Vendor Documents
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {selectedReport.vendor_documents.map((doc, idx) => (
                      <Button
                        key={`vendor-doc-${idx}`}
                        variant="outlined"
                        component="a"
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<InsertDriveFile fontSize="small" />}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none', borderRadius: '6px', maxWidth: '400px' }}
                      >
                        {doc.filename || `Vendor Document ${idx + 1}`}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}

              {selectedReport.case_documents && selectedReport.case_documents.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Case Documents (Policy, Petition, etc.)
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {selectedReport.case_documents.map((doc, idx) => (
                      <Button
                        key={`case-doc-${idx}`}
                        variant="outlined"
                        component="a"
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<InsertDriveFile fontSize="small" />}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none', borderRadius: '6px', maxWidth: '400px' }}
                      >
                        {doc.filename || `Case Document ${idx + 1}`}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}
              {selectedReport.review_notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Review Notes:
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      backgroundColor: selectedReport.status === 'REJECTED' ? '#fff5f5' : '#f0fff4',
                      border: `1px solid ${selectedReport.status === 'REJECTED' ? '#ffc9c9' : '#b2f2bb'}`,
                      borderRadius: '8px',
                    }}
                  >
                    {selectedReport.review_notes}
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseReportDetail}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Close
          </Button>
          {selectedReport?.status === 'REJECTED' && (
            <Button
              variant="outlined"
              onClick={() => openQCModal(selectedReport.id, 'reassign')}
              disabled={savingReportContent || editableReportContent !== selectedReport.report_content}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                borderColor: '#667eea',
                color: '#667eea',
                '&:hover': {
                  borderColor: '#5568d3',
                  backgroundColor: '#f0f4ff',
                },
              }}
            >
              Reassign QC
            </Button>
          )}
          {selectedReport?.status === 'REJECTED' && (
            <Button
              variant="contained"
              onClick={handleSaveReportContent}
              disabled={savingReportContent || editableReportContent === selectedReport.report_content}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: '#667eea',
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#5568d3' },
              }}
            >
              {savingReportContent ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
            </Button>
          )}
          {selectedReport && (selectedReport.status === 'PENDING' || selectedReport.status === 'ASSIGNED') && (
            <Button
              variant="contained"
              onClick={() => {
                handleCloseReportDetail();
                openQCModal(selectedReport.id);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: '#667eea',
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#5568d3' },
              }}
            >
              {selectedReport.assigned_qc_name ? 'Reassign QC' : 'Assign QC'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  </CaseManagerLayout>
  );
};

export default LegalReviewPage;
