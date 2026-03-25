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
  CircularProgress,
  Alert,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Search, FilterList, FileDownload, Description } from '@mui/icons-material';
import LawyerLayout from './components/LawyerLayout';
import api from '../../services/api';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Fetch logs
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/lawyer/logs');
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError('Failed to load activity logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getStatusColor = (action) => {
    switch (action.toLowerCase()) {
      case 'accepted':
        return { bg: '#27ae60', color: '#fff' };
      case 'rejected':
        return { bg: '#e74c3c', color: '#fff' };
      case 'pending review':
        return { bg: '#f39c12', color: '#fff' };
      default:
        return { bg: '#34495e', color: '#fff' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  // Filter logs based on search
  const filteredLogs = logs.filter((log) =>
    log.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.case_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedLogs = filteredLogs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <LawyerLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Home / Logs
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#2c3e50', mb: 3 }}>
            Activity Logs
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <TextField
              placeholder="Search logs by case number, title, or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1, maxWidth: 600 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                sx={{ borderColor: '#34495e', color: '#34495e' }}
              >
                Filter
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownload />}
                sx={{ borderColor: '#34495e', color: '#34495e' }}
              >
                Export
              </Button>
            </Box>
          </Box>

          <Box sx={{ p: 2 }}>
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
                        <TableCell><strong>Log ID</strong></TableCell>
                        <TableCell><strong>Case Number</strong></TableCell>
                        <TableCell><strong>Client Name</strong></TableCell>
                        <TableCell><strong>Action</strong></TableCell>
                        <TableCell><strong>Reviewed At</strong></TableCell>
                        <TableCell><strong>Notes</strong></TableCell>
                        <TableCell><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedLogs.map((log) => {
                        const statusStyle = getStatusColor(log.action);
                        return (
                          <TableRow key={log.id} hover>
                            <TableCell>
                              <Typography sx={{ color: '#667eea', fontWeight: 600 }}>
                                LOG-{log.id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontWeight: 500 }}>
                                {log.case_number}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {log.case_title?.substring(0, 30)}{log.case_title?.length > 30 ? '...' : ''}
                              </Typography>
                            </TableCell>
                            <TableCell>{log.client_name || '-'}</TableCell>
                            <TableCell>
                              <Chip
                                label={log.action}
                                size="small"
                                sx={{
                                  backgroundColor: statusStyle.bg,
                                  color: statusStyle.color,
                                  fontWeight: 500,
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              {formatDate(log.reviewed_at || log.assigned_at)}
                            </TableCell>
                            <TableCell>
                              <Typography
                                sx={{
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {log.review_notes || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleViewDetails(log)}
                                sx={{
                                  backgroundColor: '#34495e',
                                  '&:hover': { backgroundColor: '#2c3e50' },
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {filteredLogs.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Description sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                    <Typography color="text.secondary">
                      {logs.length === 0 ? 'No activity logs yet' : 'No logs match your search'}
                    </Typography>
                  </Box>
                )}

                <TablePagination
                  component="div"
                  count={filteredLogs.length}
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

        {/* Log Detail Dialog */}
        <Dialog
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description />
            Log Details - LOG-{selectedLog?.id}
          </DialogTitle>
          <DialogContent>
            {selectedLog && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={selectedLog.action}
                    sx={{
                      backgroundColor: getStatusColor(selectedLog.action).bg,
                      color: getStatusColor(selectedLog.action).color,
                      fontWeight: 600,
                    }}
                  />
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Case Number
                </Typography>
                <Typography sx={{ mb: 2, color: '#667eea' }}>
                  {selectedLog.case_number}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Case Title
                </Typography>
                <Typography sx={{ mb: 2 }}>
                  {selectedLog.case_title}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Client
                </Typography>
                <Typography sx={{ mb: 2 }}>
                  {selectedLog.client_name || 'N/A'}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Assigned At
                </Typography>
                <Typography sx={{ mb: 2 }}>
                  {formatDate(selectedLog.assigned_at)}
                </Typography>

                {selectedLog.reviewed_at && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Reviewed At
                    </Typography>
                    <Typography sx={{ mb: 2 }}>
                      {formatDate(selectedLog.reviewed_at)}
                    </Typography>
                  </>
                )}

                {selectedLog.review_notes && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Review Notes
                    </Typography>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        backgroundColor: selectedLog.action === 'Rejected' ? '#fff5f5' : '#f0fff4',
                        border: `1px solid ${selectedLog.action === 'Rejected' ? '#ffc9c9' : '#b2f2bb'}`,
                        borderRadius: '8px',
                      }}
                    >
                      {selectedLog.review_notes}
                    </Paper>
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDetailOpen(false)}
              sx={{ textTransform: 'none' }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LawyerLayout>
  );
};

export default LogsPage;
