import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  TablePagination,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
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
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
import api from '../../services/api';

const getEvidencePhotoUrl = (photo) => {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.preview_url || photo.url || photo.photo_url || '';
};

const resolveEvidencePhotoUrl = (photoUrl) => {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('data:')) return photoUrl;
  if (photoUrl.startsWith('http')) {
    try {
      const parsedUrl = new URL(photoUrl);
      if (parsedUrl.pathname.startsWith('/media/')) {
        return `${parsedUrl.pathname}${parsedUrl.search || ''}`;
      }
    } catch {
      return photoUrl;
    }
    return photoUrl;
  }
  if (photoUrl.startsWith('/media/')) return photoUrl;
  if (photoUrl.startsWith('media/')) return `/${photoUrl}`;
  return `/media/${photoUrl.replace(/^\/+/, '')}`;
};

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

const formatEvidenceLocationForWatermark = (photo) => {
  const locationName = typeof photo?.location_name === 'string' ? photo.location_name.trim() : '';
  const pincodeMatch = locationName.match(/\b\d{6}\b/);
  const pincode = pincodeMatch ? pincodeMatch[0] : '';
  const parts = locationName.split(',').map((part) => part.trim()).filter(Boolean);
  let city = '';

  if (pincode) {
    const pincodeIndex = parts.findIndex((part) => part.includes(pincode));
    if (pincodeIndex > 0) {
      city = parts[pincodeIndex - 1].replace(/\b\d{6}\b/g, '').trim();
    }
  }

  if (!city) {
    city = parts.find((part) => /[A-Za-z]/.test(part) && !/\b\d{6}\b/.test(part) && !/^india$/i.test(part)) || '';
  }

  if (city && pincode) return `${city}, ${pincode}`;
  if (city) return city;
  if (pincode) return pincode;
  return '';
};

const getEvidenceWatermarkLines = (photo) => {
  const locationLine = formatEvidenceLocationForWatermark(photo);
  const timestamp = formatEvidenceTimestamp(photo);
  return [locationLine, timestamp].filter(Boolean);
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

  // Lawyer assignment modal state
  const [lawyerModalOpen, setLawyerModalOpen] = useState(false);
  const [lawyers, setLawyers] = useState([]);
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [assigningLawyer, setAssigningLawyer] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [lawyersLoading, setLawyersLoading] = useState(false);
  const [lawyersError, setLawyersError] = useState(null);

  // Report detail modal state
  const [reportDetailOpen, setReportDetailOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

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

  // Open lawyer assignment modal
  const openLawyerModal = async (reportId) => {
    setSelectedReportId(reportId);
    setSelectedLawyerId('');
    setLawyersLoading(true);
    setLawyersError(null);
    setLawyerModalOpen(true);
    try {
      const res = await api.get('/lawyers');
      console.log('Lawyers API response:', res);
      setLawyers(res.data || []);
      if (!res.data || res.data.length === 0) {
        setLawyersError('No lawyers found in the system.');
      }
    } catch (err) {
      console.error('Failed to fetch lawyers:', err);
      setLawyersError(err.response?.data?.detail || err.message || 'Failed to load lawyers');
      setLawyers([]);
    } finally {
      setLawyersLoading(false);
    }
  };

  // Handle lawyer assignment
  const handleAssignLawyer = async () => {
    if (!selectedReportId || !selectedLawyerId) return;
    setAssigningLawyer(true);
    try {
      await api.post(`/reports/${selectedReportId}/assign`, {
        lawyer_id: selectedLawyerId,
      });
      setLawyerModalOpen(false);
      setSelectedReportId(null);
      await fetchReports();
    } catch (err) {
      console.error('Failed to assign lawyer:', err);
      alert('Failed to assign lawyer. Please try again.');
    } finally {
      setAssigningLawyer(false);
    }
  };

  // Open report detail modal
  const openReportDetail = async (reportId) => {
    try {
      const res = await api.get(`/reports/${reportId}`);
      setSelectedReport(res.data);
      setReportDetailOpen(true);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      alert('Failed to load report details.');
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
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          Legal Review
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
                <MenuItem value="accepted">Accepted</MenuItem>
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
                    Assigned Lawyer
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
                        {row.assigned_lawyer_name ? (
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
                              {row.assigned_lawyer_name}
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
                          label={row.status}
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
                              onClick={() => openLawyerModal(row.id)}
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
                              {row.assigned_lawyer_name ? 'Reassign' : 'Assign Lawyer'}
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

      {/* Lawyer Assignment Modal */}
      <Dialog
        open={lawyerModalOpen}
        onClose={() => setLawyerModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1 }}>
          Assign Lawyer
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: '#666', mb: 2 }}>
            Select a lawyer to assign for legal review of this report.
          </Typography>
          {lawyersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : lawyersError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {lawyersError}
            </Alert>
          ) : (
            <FormControl fullWidth size="small">
              <Select
                value={selectedLawyerId}
                onChange={(e) => setSelectedLawyerId(e.target.value)}
                displayEmpty
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="" disabled>Select a lawyer</MenuItem>
                {lawyers.map((lawyer) => (
                  <MenuItem key={lawyer.id} value={lawyer.id}>
                    {lawyer.full_name || lawyer.username} ({lawyer.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {!lawyersLoading && !lawyersError && lawyers.length === 0 && (
            <Typography sx={{ fontSize: '13px', color: '#ff6b6b', mt: 1 }}>
              No lawyers available. Please add lawyers to the system first.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setLawyerModalOpen(false)}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!selectedLawyerId || assigningLawyer}
            onClick={handleAssignLawyer}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#667eea',
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#5568d3' },
            }}
          >
            {assigningLawyer ? <CircularProgress size={20} color="inherit" /> : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Detail Modal */}
      <Dialog
        open={reportDetailOpen}
        onClose={() => setReportDetailOpen(false)}
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
                  label={`Status: ${selectedReport.status}`}
                  sx={{
                    backgroundColor: `${getStatusColor(selectedReport.status)}15`,
                    color: getStatusColor(selectedReport.status),
                    fontWeight: 600,
                  }}
                />
                {selectedReport.assigned_lawyer_name && (
                  <Chip
                    icon={<Gavel />}
                    label={`Assigned: ${selectedReport.assigned_lawyer_name}`}
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
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  maxHeight: 400,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                }}
              >
                {selectedReport.report_content}
              </Paper>
              {selectedReport.evidence_photos && selectedReport.evidence_photos.length > 0 && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.25 }}>
                    Vendor Evidence:
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1.5,
                      maxHeight: 420,
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
                            backgroundColor: '#0f172a',
                            position: 'relative',
                          }}
                        >
                          <img
                            src={resolveEvidencePhotoUrl(photoUrl)}
                            alt={`Vendor Evidence ${idx + 1}`}
                            style={{
                              width: '100%',
                              height: '220px',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                          {watermarkLines.length > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                px: 1.25,
                                py: 0.75,
                                background: 'linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.9) 55%, rgba(15,23,42,0.98) 100%)',
                              }}
                            >
                              {watermarkLines.map((line, lineIndex) => (
                                <Typography
                                  key={`legal-watermark-${idx}-${lineIndex}`}
                                  sx={{
                                    fontSize: '11px',
                                    lineHeight: 1.35,
                                    color: '#fff',
                                    fontWeight: 600,
                                    textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                                  }}
                                >
                                  {line}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
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
            onClick={() => setReportDetailOpen(false)}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Close
          </Button>
          {selectedReport && (selectedReport.status === 'PENDING' || selectedReport.status === 'ASSIGNED') && (
            <Button
              variant="contained"
              onClick={() => {
                setReportDetailOpen(false);
                openLawyerModal(selectedReport.id);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: '#667eea',
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#5568d3' },
              }}
            >
              {selectedReport.assigned_lawyer_name ? 'Reassign Lawyer' : 'Assign Lawyer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

export default LegalReviewPage;
