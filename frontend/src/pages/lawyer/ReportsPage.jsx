import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  TablePagination,
} from '@mui/material';
import {
  Search,
  Description,
  CheckCircle,
  Cancel,
  Schedule,
  Assignment,
} from '@mui/icons-material';
import LawyerLayout from './components/LawyerLayout';
import api from '../../services/api';

const ReportsPage = () => {
  // State for data
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch reports
  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, statsRes] = await Promise.all([
        api.get('/lawyer/reports'),
        api.get('/lawyer/reports/stats'),
      ]);
      setReports(reportsRes.data || []);
      setStats(statsRes.data || { total: 0, pending: 0, accepted: 0, rejected: 0 });
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Open review dialog
  const handleReview = async (reportId) => {
    try {
      const res = await api.get(`/reports/${reportId}`);
      setSelectedReport(res.data);
      setReviewNotes('');
      setReviewDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      alert('Failed to load report details.');
    }
  };

  const handleCloseDialog = () => {
    setReviewDialogOpen(false);
    setSelectedReport(null);
    setReviewNotes('');
  };

  // Accept report
  const handleAccept = async () => {
    if (!selectedReport) return;
    setSubmitting(true);
    try {
      await api.post(`/lawyer/reports/${selectedReport.id}/review`, {
        action: 'accept',
        notes: reviewNotes,
      });
      handleCloseDialog();
      await fetchReports();
    } catch (err) {
      console.error('Failed to accept report:', err);
      alert('Failed to accept report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reject report
  const handleReject = async () => {
    if (!selectedReport) return;
    if (!reviewNotes.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/lawyer/reports/${selectedReport.id}/review`, {
        action: 'reject',
        notes: reviewNotes,
      });
      handleCloseDialog();
      await fetchReports();
    } catch (err) {
      console.error('Failed to reject report:', err);
      alert('Failed to reject report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter reports based on tab and search
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.case_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.client_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const isPending = report.status === 'ASSIGNED' || report.status === 'PENDING';
    const isReviewed = report.status === 'ACCEPTED' || report.status === 'REJECTED';

    const matchesTab = activeTab === 0 ? isPending : isReviewed;

    return matchesSearch && matchesTab;
  });

  const paginatedReports = filteredReports.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <LawyerLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Home / Reports
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#2c3e50' }}>
            Reports
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color="primary">
              {stats.total}
            </Typography>
            <Typography color="text.secondary">Total Assigned</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: '#ff922b' }}>
              {stats.pending}
            </Typography>
            <Typography color="text.secondary">Pending Review</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: '#51cf66' }}>
              {stats.accepted}
            </Typography>
            <Typography color="text.secondary">Accepted</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: '#ff6b6b' }}>
              {stats.rejected}
            </Typography>
            <Typography color="text.secondary">Rejected</Typography>
          </Paper>
        </Box>

        <Paper sx={{ overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => {
              setActiveTab(newValue);
              setPage(0);
            }}
            sx={{
              backgroundColor: '#34495e',
              '& .MuiTab-root': { color: '#ecf0f1', fontWeight: 600 },
              '& .Mui-selected': { color: '#3498db' },
            }}
          >
            <Tab label={`Pending Review (${stats.pending})`} />
            <Tab label={`Reviewed (${stats.accepted + stats.rejected})`} />
          </Tabs>

          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder="Search reports by case number, title, or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableRow>
                        <TableCell><strong>Case Number</strong></TableCell>
                        <TableCell><strong>Case Title</strong></TableCell>
                        <TableCell><strong>Client</strong></TableCell>
                        <TableCell><strong>Category</strong></TableCell>
                        <TableCell><strong>Assigned On</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedReports.map((report) => (
                        <TableRow key={report.id} hover>
                          <TableCell>
                            <Typography sx={{ color: '#667eea', fontWeight: 600 }}>
                              {report.case_number}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ maxWidth: 250 }} noWrap>
                              {report.case_title}
                            </Typography>
                          </TableCell>
                          <TableCell>{report.client_name || '-'}</TableCell>
                          <TableCell>{report.category}</TableCell>
                          <TableCell>{formatDate(report.assigned_at)}</TableCell>
                          <TableCell>
                            <Chip
                              icon={getStatusIcon(report.status)}
                              label={report.status}
                              size="small"
                              sx={{
                                backgroundColor: `${getStatusColor(report.status)}15`,
                                color: getStatusColor(report.status),
                                fontWeight: 500,
                                '& .MuiChip-icon': {
                                  color: getStatusColor(report.status),
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleReview(report.id)}
                              sx={{
                                backgroundColor: '#34495e',
                                '&:hover': { backgroundColor: '#2c3e50' },
                              }}
                            >
                              {report.status === 'ASSIGNED' ? 'Review' : 'View'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {filteredReports.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Description sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                    <Typography color="text.secondary">
                      {activeTab === 0 ? 'No pending reports' : 'No reviewed reports'}
                    </Typography>
                  </Box>
                )}

                <TablePagination
                  component="div"
                  count={filteredReports.length}
                  page={page}
                  onPageChange={(e, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </>
            )}
          </Box>
        </Paper>

        {/* Review Dialog */}
        <Dialog
          open={reviewDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description sx={{ color: '#34495e' }} />
            Review Report - {selectedReport?.case_number}
          </DialogTitle>
          <DialogContent>
            {selectedReport && (
              <Box>
                {/* Report info */}
                <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={`Status: ${selectedReport.status}`}
                    sx={{
                      backgroundColor: `${getStatusColor(selectedReport.status)}15`,
                      color: getStatusColor(selectedReport.status),
                      fontWeight: 600,
                    }}
                  />
                  <Chip
                    label={`Category: ${selectedReport.category}`}
                    sx={{ backgroundColor: '#e3f2fd', color: '#1976d2' }}
                  />
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Case: {selectedReport.case_title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Client: {selectedReport.client_name || 'N/A'} | Claim: {selectedReport.claim_number || 'N/A'}
                </Typography>

                {/* AI Report Content */}
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
                    maxHeight: 300,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    mb: 2,
                  }}
                >
                  {selectedReport.report_content}
                </Paper>

                {/* Review notes input (only for pending reports) */}
                {selectedReport.status === 'ASSIGNED' && (
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Review Notes"
                    placeholder="Add your review notes here (required for rejection)"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                )}

                {/* Show existing review notes for reviewed reports */}
                {selectedReport.review_notes && (
                  <Box>
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
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleCloseDialog} variant="outlined" disabled={submitting}>
              Cancel
            </Button>
            {selectedReport?.status === 'ASSIGNED' && (
              <>
                <Button
                  onClick={handleReject}
                  variant="contained"
                  disabled={submitting}
                  sx={{
                    backgroundColor: '#e74c3c',
                    '&:hover': { backgroundColor: '#c0392b' },
                  }}
                >
                  {submitting ? <CircularProgress size={20} color="inherit" /> : 'Reject Report'}
                </Button>
                <Button
                  onClick={handleAccept}
                  variant="contained"
                  disabled={submitting}
                  sx={{
                    backgroundColor: '#27ae60',
                    '&:hover': { backgroundColor: '#229954' },
                  }}
                >
                  {submitting ? <CircularProgress size={20} color="inherit" /> : 'Accept Report'}
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </LawyerLayout>
  );
};

export default ReportsPage;
