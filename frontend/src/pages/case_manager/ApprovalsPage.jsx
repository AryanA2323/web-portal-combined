import { useState, useEffect, useRef } from 'react';
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
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Check,
  Close,
  AccessTime,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import CaseManagerLayout from './components/CaseManagerLayout';
import api from '../../services/api';
import AlertMessage from '../../components/common/AlertMessage';
import { NotificationBell } from '../../components/case_manager';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const ApprovalsPage = () => {
  const location = useLocation();
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const hasHandledNavState = useRef(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const delRes = await api.get('/super-admin/deletion-requests/');
      setDeletionRequests(delRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Auto-refresh approvals every 30 seconds and on tab focus
  useAutoRefresh(fetchRequests, 30000);

  useEffect(() => {
    if (hasHandledNavState.current) return;
    if (location.state?.requestId) {
      const targetId = location.state.requestId;
      if (deletionRequests && deletionRequests.length > 0) {
        const found = deletionRequests.find((r) => String(r.id) === String(targetId));
        if (found) {
          setSelectedReq(found);
          setReviewOpen(true);
        }
        hasHandledNavState.current = true;
        window.history.replaceState({}, '');
      }
    }
  }, [location.state, deletionRequests]);

  const handleReviewAction = async (action) => {
    if (!selectedReq) return;
    setActionLoading(true);
    try {
      await api.post(`/super-admin/deletion-requests/${selectedReq.id}/review`, { action });
      setSuccess(`Request ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`);
      setReviewOpen(false);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action.toLowerCase()} request`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <CaseManagerLayout>
      <Box>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
            Approvals
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#64748b' }}>
              Case Deletions
            </Typography>
            <NotificationBell />
          </Box>
        </Box>

        <AlertMessage severity="error" message={error} open={!!error} onClose={() => setError('')} />
        <AlertMessage severity="success" message={success} open={!!success} onClose={() => setSuccess('')} />

        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Case Number</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Requested By</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={30} />
                    </TableCell>
                  </TableRow>
                ) : deletionRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: '#64748b' }}>
                      No case deletion requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  deletionRequests.map((req) => (
                    <TableRow key={req.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{req.case_number || req.case_id}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>
                          {req.requested_by_name}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(req.requested_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={req.status}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: '11px',
                            bgcolor: req.status === 'PENDING' ? '#fef3c7' : req.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                            color: req.status === 'PENDING' ? '#d97706' : req.status === 'APPROVED' ? '#166534' : '#991b1b',
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { setSelectedReq(req); setReviewOpen(true); }}
                          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Review Modal */}
        <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
            Review Case Deletion Request
            <IconButton onClick={() => setReviewOpen(false)} size="small" sx={{ position: 'absolute', right: 16, top: 16 }}>
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ py: 3 }}>
            {selectedReq && (
              <Box>
                  <Box sx={{ p: 2, mb: 3, bgcolor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    <Typography sx={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, textTransform: 'uppercase', mb: 0.5 }}>Target Case</Typography>
                    <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#991b1b' }}>{selectedReq.case_number || selectedReq.case_id}</Typography>
                  </Box>
                <Typography sx={{ fontSize: '13px', color: '#64748b', fontWeight: 600, mb: 0.5 }}>Reason for deletion:</Typography>
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: '8px', fontSize: '14px', color: '#1e293b' }}>
                  {selectedReq.reason}
                </Paper>

                {selectedReq.status !== 'PENDING' && (
                  <Box sx={{ mt: 3, p: 2, borderRadius: '8px', bgcolor: selectedReq.status === 'APPROVED' ? '#f0fdf4' : '#fef2f2' }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: selectedReq.status === 'APPROVED' ? '#166534' : '#991b1b' }}>
                      This request was {selectedReq.status.toLowerCase()} by {selectedReq.reviewed_by_name} on {new Date(selectedReq.reviewed_at).toLocaleDateString()}.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          {selectedReq?.status === 'PENDING' && (
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button
                onClick={() => handleReviewAction('REJECT')}
                disabled={actionLoading}
                variant="outlined"
                color="error"
                startIcon={<Close />}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              >
                Reject Request
              </Button>
              <Button
                variant="contained"
                onClick={() => handleReviewAction('APPROVE')}
                disabled={actionLoading}
                startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <Check />}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
              >
                Approve Change
              </Button>
            </DialogActions>
          )}
        </Dialog>
      </Box>
    </CaseManagerLayout>
  );
};

export default ApprovalsPage;
