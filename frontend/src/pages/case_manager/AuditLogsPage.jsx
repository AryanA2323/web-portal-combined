import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { FileDownload, History, Refresh, Search } from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import api from '../../services/api';
import AlertMessage from '../../components/common/AlertMessage';
import { NotificationBell } from '../../components/case_manager';

const eventTypeColor = {
  CASE_CREATED: '#4c6ef5',
  USER_CREATED: '#0ca678',
  VENDOR_ASSIGNED: '#ff922b',
  QC_ASSIGNED: '#9c36b5',
  AI_REPORT_GENERATED: '#2b8a3e',
  QC_ACCEPTED_REPORT: '#2f9e44',
  QC_REJECTED_REPORT: '#e03131',
};

const formatEventType = (value) => {
  if (!value) return 'UNKNOWN';
  return String(value)
    .replace('ACCEPTED', 'APPROVED')
    .replaceAll('_', ' ');
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/audit-logs', { params: { limit: 1000 } });
      setLogs(response.data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit logs.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();

    const intervalId = setInterval(() => {
      fetchAuditLogs();
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  const filteredLogs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      if (typeFilter !== 'all' && log.event_type !== typeFilter) return false;
      if (userFilter !== 'all' && (log.actor || '') !== userFilter) return false;
      if (dateRange !== 'all') {
        const eventDate = new Date(log.event_time);
        const now = new Date();
        if (dateRange === 'today' && eventDate.toDateString() !== now.toDateString()) return false;
        if (dateRange === 'week') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (eventDate < sevenDaysAgo) return false;
        }
        if (dateRange === 'month') {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (eventDate < thirtyDaysAgo) return false;
        }
      }

      if (!search) return true;

      return (
        String(log.description || '').toLowerCase().includes(search)
        || String(log.case_number || '').toLowerCase().includes(search)
        || String(log.actor || '').toLowerCase().includes(search)
        || String(log.source || '').toLowerCase().includes(search)
      );
    });
  }, [logs, typeFilter, userFilter, dateRange, searchTerm]);

  const eventTypes = useMemo(() => {
    return Array.from(new Set(logs.map((item) => item.event_type).filter(Boolean))).sort();
  }, [logs]);

  const users = useMemo(() => {
    return Array.from(new Set(logs.map((item) => item.actor).filter(Boolean))).sort();
  }, [logs]);

  const paginatedLogs = filteredLogs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const handleChangePage = (_, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDateTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString();
  };

  return (
    <CaseManagerLayout disablePadding>
      {/* Top Header Section - Audit Logs Theme */}
      <Box
        sx={{
          minHeight: 110,
          py: 1.75,
          mx: { xs: 1.5, md: 2.5 },
          px: { xs: 2, md: 3 },
          borderRadius: '0 0 16px 16px',
          boxSizing: 'border-box',
          background: 'linear-gradient(120deg, #f8fafc 0%, #f1f5f9 30%, #e2e8f0 65%, #ede9fe 100%)',
          boxShadow: '0 4px 16px rgba(148, 163, 184, 0.08)',
          display: 'flex',
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
            background: 'radial-gradient(circle at 10% 20%, rgba(100, 116, 139, 0.18) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.20) 0%, transparent 40%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Left Side: Title & History Icon */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(71, 85, 105, 0.18)',
            }}
          >
            <History sx={{ fontSize: 26, color: '#475569' }} />
          </Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.5rem', md: '1.9rem' },
              letterSpacing: '-0.8px',
              background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            Audit Logs
          </Typography>
        </Box>

        {/* Right Side: Notification Bell Container */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center' }}>
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

      {error ? (
        <AlertMessage severity="error" onClose={() => setError('')} message={error} open={!!error} />
      ) : null}

      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#333' }}>
              Project Activity Logs (Last 90 Days)
            </Typography>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(0);
                }}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Event Types</MenuItem>
                {eventTypes.map((type) => (
                  <MenuItem key={type} value={type}>{formatEventType(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value);
                  setPage(0);
                }}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Users</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user} value={user}>{user}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setPage(0);
                }}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Dates</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">Last 7 Days</MenuItem>
                <MenuItem value="month">Last 30 Days</MenuItem>
              </Select>
            </FormControl>

            <TextField
              placeholder="Search logs..."
              size="small"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#999', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                ml: 'auto',
                width: '250px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  backgroundColor: '#f5f5f5',
                  '& fieldset': { border: 'none' },
                },
              }}
            />

            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={fetchAuditLogs}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
            >
              Refresh
            </Button>

            <Button
              variant="contained"
              startIcon={<FileDownload />}
              sx={{
                backgroundColor: '#667eea',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                px: 2.5,
                '&:hover': { backgroundColor: '#5568d3' },
              }}
              disabled
            >
              Export Logs
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Date / Time</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Event Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Actor</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Case</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={26} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center', color: '#666' }}>
                    No logs found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((row, idx) => (
                  <TableRow key={`${row.event_time}-${row.description}-${idx}`} hover sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                    <TableCell>{formatDateTime(row.event_time)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={formatEventType(row.event_type)}
                        sx={{
                          fontWeight: 600,
                          color: eventTypeColor[row.event_type] || '#495057',
                          backgroundColor: `${eventTypeColor[row.event_type] || '#dee2e6'}22`,
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.actor || 'System'}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1976d2' }}>{row.case_number || '-'}</TableCell>
                    <TableCell>{row.source || 'System'}</TableCell>
                    <TableCell>{row.description || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredLogs.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          sx={{ borderTop: '1px solid #e0e0e0' }}
        />
      </Paper>
    </Box>
  </CaseManagerLayout>
  );
};

export default AuditLogsPage;
