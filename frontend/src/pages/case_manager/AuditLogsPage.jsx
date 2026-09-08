import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
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
  Tooltip,
  Avatar,
  Tabs,
  Tab,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  FileDownload,
  History,
  Refresh,
  Search,
  Clear,
  FolderOpen,
  Person,
  GroupAdd,
  SwapHoriz,
  FactCheck,
  Sync,
  CloudUpload,
  Description as DescriptionIcon,
  DeleteOutline,
  DeleteSweep,
  AutoAwesome,
  CheckCircle,
  Cancel,
  Business,
  Assignment,
  ContentCopy,
  RestartAlt,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import api from '../../services/api';
import AlertMessage from '../../components/common/AlertMessage';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { NotificationBell } from '../../components/case_manager';

const eventTypeMeta = {
  CASE_CREATED: { label: 'Case Created', color: '#2563eb', bg: '#eff6ff', icon: FolderOpen },
  CASE_DELETED: { label: 'Case Deleted', color: '#dc2626', bg: '#fef2f2', icon: DeleteOutline },
  CASE_DELETION_REQUESTED: { label: 'Deletion Requested', color: '#d97706', bg: '#fffbeb', icon: DeleteSweep },
  USER_CREATED: { label: 'User Created', color: '#059669', bg: '#ecfdf5', icon: Person },
  VENDOR_ASSIGNED: { label: 'Partner Assigned', color: '#ea580c', bg: '#fff7ed', icon: GroupAdd },
  VENDOR_REASSIGNED: { label: 'Partner Reassigned', color: '#d97706', bg: '#fffbeb', icon: SwapHoriz },
  VENDOR_STATUS_CHANGE: { label: 'Partner Status', color: '#7c3aed', bg: '#f5f3ff', icon: Sync },
  QC_ASSIGNED: { label: 'QC Assigned', color: '#9333ea', bg: '#faf5ff', icon: Person },
  QC_ACCEPTED_REPORT: { label: 'Report Approved', color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle },
  QC_REJECTED_REPORT: { label: 'Report Rejected', color: '#dc2626', bg: '#fef2f2', icon: Cancel },
  AI_REPORT_GENERATED: { label: 'AI Review Generated', color: '#0d9488', bg: '#f0fdfa', icon: AutoAwesome },
  REPORT_GENERATED: { label: 'Report Generated', color: '#15803d', bg: '#f0fdf4', icon: Assignment },
  FIELD_UPDATED: { label: 'Field Updated', color: '#17539C', bg: '#eff6ff', icon: Sync },
  CHECK_REVIEWED: { label: 'Check Reviewed', color: '#0f766e', bg: '#f0fdfa', icon: FactCheck },
  CHECK_SUBMITTED: { label: 'Check Submitted', color: '#c2410c', bg: '#fff7ed', icon: CheckCircle },
  MEDIA_UPLOADED: { label: 'Media Uploaded', color: '#0284c7', bg: '#f0f9ff', icon: CloudUpload },
  RTO_DOCS_GENERATED: { label: 'RTO Docs Generated', color: '#0891b2', bg: '#ecfeff', icon: DescriptionIcon },
};

const getEventConfig = (type) => {
  if (eventTypeMeta[type]) return eventTypeMeta[type];
  return {
    label: String(type || 'ACTIVITY').replace('ACCEPTED', 'APPROVED').replaceAll('_', ' '),
    color: '#475569',
    bg: '#f1f5f9',
    icon: History,
  };
};

const formatEventType = (value) => {
  if (!value) return 'ACTIVITY';
  return String(value)
    .replace('ACCEPTED', 'APPROVED')
    .replaceAll('_', ' ');
};

// Formats log descriptions cleanly with inline badges and natural text flow
const RenderSmartDescription = ({ description }) => {
  if (!description) return <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '13px' }}>-</Typography>;

  const text = String(description);

  // 1. Vendor Reassignment pattern: "Vendor reassigned from 'Old' to 'New'"
  const reassignMatch = text.match(/Vendor reassigned from '([^']+)' to '([^']+)'/i);
  if (reassignMatch) {
    const [, fromVendor, toVendor] = reassignMatch;
    return (
      <Typography variant="body2" sx={{ color: '#334155', fontSize: '13px', lineHeight: 1.5 }}>
        Partner reassigned from{' '}
        <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '12px' }}>
          {fromVendor === 'None' ? 'Unassigned' : fromVendor}
        </span>
        {' '}➔{' '}
        <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '12px' }}>
          {toVendor}
        </span>
      </Typography>
    );
  }

  // 2. Vendor Assigned pattern: "Vendor 'X' assigned to Check Y"
  const assignMatch = text.match(/Vendor '([^']+)' assigned to (.*)/i);
  if (assignMatch) {
    const [, vendorName, checkTarget] = assignMatch;
    return (
      <Typography variant="body2" sx={{ color: '#334155', fontSize: '13px', lineHeight: 1.5 }}>
        Assigned partner{' '}
        <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '12px' }}>
          {vendorName}
        </span>
        {' '}to{' '}
        <span style={{ backgroundColor: '#f8fafc', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', border: '1px solid #e2e8f0' }}>
          {checkTarget}
        </span>
      </Typography>
    );
  }

  // 3. Field update pattern: "Field 'X' changed from 'A' to 'B'"
  const fieldMatch = text.match(/Field '([^']+)' changed from '([^']*)' to '([^']*)'/i);
  if (fieldMatch) {
    const [, field, oldVal, newVal] = fieldMatch;
    return (
      <Typography variant="body2" sx={{ color: '#334155', fontSize: '13px', lineHeight: 1.5 }}>
        Updated <strong style={{ color: '#0f172a' }}>{field}</strong>:{' '}
        <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
          {oldVal || 'None'}
        </span>
        {' '}➔{' '}
        <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '12px' }}>
          {newVal || 'Empty'}
        </span>
      </Typography>
    );
  }

  // 4. QC Review pattern: "QC 'Name' approved/rejected report for case X"
  const qcMatch = text.match(/QC '([^']+)' (approved|rejected) report for case (.*)/i);
  if (qcMatch) {
    const [, qcName, decision, caseNum] = qcMatch;
    const isApproved = decision.toLowerCase() === 'approved';
    return (
      <Typography variant="body2" sx={{ color: '#334155', fontSize: '13px', lineHeight: 1.5 }}>
        <span
          style={{
            backgroundColor: isApproved ? '#f0fdf4' : '#fef2f2',
            color: isApproved ? '#16a34a' : '#dc2626',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 700,
            fontSize: '11.5px',
            marginRight: '6px',
          }}
        >
          {isApproved ? 'Report Approved' : 'Report Rejected'}
        </span>
        by <strong style={{ color: '#0f172a' }}>{qcName}</strong> (Case {caseNum})
      </Typography>
    );
  }

  // Default clean text
  return (
    <Typography variant="body2" sx={{ color: '#334155', fontSize: '13px', lineHeight: 1.5 }}>
      {text}
    </Typography>
  );
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Snackbar
  const [toastMessage, setToastMessage] = useState('');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/audit-logs', {
        params: {
          limit: 1000,
          include_archived: dateRange === 'archived',
        },
      });
      setLogs(response.data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit logs. Please try again.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [dateRange, activeTab]);

  useAutoRefresh(fetchAuditLogs);

  // Category Tab Classifier
  const isMatchTab = (log, tab) => {
    if (tab === 'all') return true;
    if (tab === 'cases') {
      return ['CASE_CREATED', 'CASE_DELETED', 'CASE_DELETION_REQUESTED', 'FIELD_UPDATED', 'MEDIA_UPLOADED'].includes(log.event_type);
    }
    if (tab === 'partners') {
      return ['VENDOR_ASSIGNED', 'VENDOR_REASSIGNED', 'VENDOR_STATUS_CHANGE', 'CHECK_SUBMITTED'].includes(log.event_type);
    }
    if (tab === 'quality') {
      return ['QC_ASSIGNED', 'QC_ACCEPTED_REPORT', 'QC_REJECTED_REPORT', 'AI_REPORT_GENERATED', 'REPORT_GENERATED', 'CHECK_REVIEWED'].includes(log.event_type);
    }
    if (tab === 'users') {
      return ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'LOGIN'].includes(log.event_type) || String(log.source || '').includes('User');
    }
    return true;
  };

  const filteredLogs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      // Tab Category Filter
      if (!isMatchTab(log, activeTab)) return false;

      // Event Type Filter
      if (typeFilter !== 'all' && log.event_type !== typeFilter) return false;

      // User Filter
      if (userFilter !== 'all' && (log.actor || '') !== userFilter) return false;

      // Client Filter
      if (clientFilter !== 'all' && (log.client_name || '') !== clientFilter) return false;

      // Date Range Filter
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
        if (dateRange === 'archived') {
          const ninetyDaysAgo = new Date(now);
          ninetyDaysAgo.setDate(now.getDate() - 90);
          if (eventDate >= ninetyDaysAgo && !log.is_archived) return false;
        }
      }

      // Search Filter
      if (!search) return true;
      return (
        String(log.description || '').toLowerCase().includes(search) ||
        String(log.case_number || '').toLowerCase().includes(search) ||
        String(log.client_name || '').toLowerCase().includes(search) ||
        String(log.actor || '').toLowerCase().includes(search) ||
        String(log.source || '').toLowerCase().includes(search) ||
        String(log.event_type || '').toLowerCase().includes(search)
      );
    });
  }, [logs, activeTab, typeFilter, userFilter, clientFilter, dateRange, searchTerm]);

  const eventTypes = useMemo(() => {
    return Array.from(new Set(logs.map((item) => item.event_type).filter(Boolean))).sort();
  }, [logs]);

  const users = useMemo(() => {
    return Array.from(new Set(logs.map((item) => item.actor).filter(Boolean))).sort();
  }, [logs]);

  const clients = useMemo(() => {
    return Array.from(new Set(logs.map((item) => item.client_name).filter(Boolean))).sort();
  }, [logs]);

  const paginatedLogs = filteredLogs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const hasActiveFilters = searchTerm !== '' || typeFilter !== 'all' || userFilter !== 'all' || clientFilter !== 'all' || dateRange !== 'all' || activeTab !== 'all';

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setUserFilter('all');
    setClientFilter('all');
    setDateRange('all');
    setActiveTab('all');
    setPage(0);
  };

  const handleCopyText = (text, label = 'Copied to clipboard') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setToastMessage(label);
  };

  const formatDateTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDateOnly = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTimeOnly = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) return;

    const headers = ['Date / Time', 'Event Type', 'Actor', 'Case Number', 'Client Name', 'Source', 'Description', 'Is Archived'];
    const rows = filteredLogs.map((log) => [
      `"${formatDateTime(log.event_time).replace(/"/g, '""')}"`,
      `"${(formatEventType(log.event_type) || '').replace(/"/g, '""')}"`,
      `"${(log.actor || 'System').replace(/"/g, '""')}"`,
      `"${(log.case_number || '-').replace(/"/g, '""')}"`,
      `"${(log.client_name || '-').replace(/"/g, '""')}"`,
      `"${(log.source || 'System').replace(/"/g, '""')}"`,
      `"${(log.description || '-').replace(/"/g, '""')}"`,
      log.is_archived ? 'Yes' : 'No',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage('Exported audit logs to CSV');
  };

  return (
    <CaseManagerLayout disablePadding>
      {/* Top Header Banner */}
      <Box
        sx={{
          minHeight: 100,
          py: 2,
          mx: { xs: 1.5, md: 2.5 },
          px: { xs: 2, md: 3 },
          borderRadius: '0 0 16px 16px',
          boxSizing: 'border-box',
          background: 'linear-gradient(135deg, #17539C 0%, #1e40af 100%)',
          boxShadow: '0 6px 20px rgba(23, 83, 156, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          position: 'relative',
          border: '1px solid #1e3a8a',
          borderTop: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: '12px',
              bgcolor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            <History sx={{ fontSize: 26, color: '#17539C' }} />
          </Box>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.4rem', md: '1.75rem' },
                letterSpacing: '-0.6px',
                color: '#ffffff',
                lineHeight: 1.2,
              }}
            >
              Audit & Activity Logs
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: { xs: '12px', md: '13px' },
                mt: 0.25,
              }}
            >
              Forensic audit trail, system lifecycle events, and chronological operations stream.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              bgcolor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              p: 0.5,
              flexShrink: 0,
              transition: 'all 0.2s',
              '&:hover': { transform: 'scale(1.03)' },
            }}
          >
            <NotificationBell />
          </Box>
        </Box>
      </Box>

      {/* Main Page Container */}
      <Box sx={{ p: { xs: 2, md: 3 }, pt: 2 }}>
        {error ? (
          <AlertMessage severity="error" onClose={() => setError('')} message={error} open={!!error} />
        ) : null}

        {/* Main Table Paper */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
            overflow: 'hidden',
          }}
        >
          {/* Category Tabs (Clean & Professional) */}
          <Box sx={{ px: 2.5, pt: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Tabs
              value={activeTab}
              onChange={(_, val) => {
                setActiveTab(val);
                setPage(0);
              }}
              sx={{
                minHeight: '44px',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  minHeight: '44px',
                  py: 1,
                  px: 2.5,
                  color: '#64748b',
                  '&.Mui-selected': { color: '#17539C', fontWeight: 700 },
                },
                '& .MuiTabs-indicator': { backgroundColor: '#17539C', height: 3, borderRadius: '3px 3px 0 0' },
              }}
            >
              <Tab value="all" label="All Activities" />
              <Tab value="cases" label="Case Operations" />
              <Tab value="partners" label="Partner Actions" />
              <Tab value="quality" label="QC & Reviews" />
              <Tab value="users" label="User Management" />
            </Tabs>
          </Box>

          {/* Action & Filter Toolbar Area */}
          <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Top Toolbar Row: Stream Status, Count & Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#16a34a',
                      boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.2)',
                    }}
                  />
                  <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                    Activity Stream
                  </Typography>
                </Box>

                <Chip
                  size="small"
                  label="Last 90 Days Active"
                  sx={{
                    fontWeight: 600,
                    fontSize: '11.5px',
                    bgcolor: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                  }}
                />

                <Chip
                  size="small"
                  label={`${filteredLogs.length} Records`}
                  sx={{ fontWeight: 700, fontSize: '11.5px', bgcolor: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0' }}
                />

                {hasActiveFilters && (
                  <Button
                    size="small"
                    startIcon={<RestartAlt sx={{ fontSize: 16 }} />}
                    onClick={handleResetFilters}
                    sx={{ textTransform: 'none', fontSize: '12px', color: '#64748b', fontWeight: 600 }}
                  >
                    Reset Filters
                  </Button>
                )}
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FileDownload sx={{ fontSize: 18 }} />}
                  onClick={handleExportCSV}
                  disabled={filteredLogs.length === 0}
                  sx={{
                    backgroundColor: '#17539C',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    borderRadius: '8px',
                    px: 2,
                    boxShadow: '0 2px 6px rgba(23, 83, 156, 0.25)',
                    '&:hover': { backgroundColor: '#134480' },
                    '&.Mui-disabled': {
                      backgroundColor: '#e2e8f0',
                      color: '#94a3b8',
                    },
                  }}
                >
                  Export CSV
                </Button>

                <Tooltip title="Refresh log feed">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Refresh sx={{ fontSize: 18, animation: loading ? 'spin 1s linear infinite' : 'none' }} />}
                    onClick={fetchAuditLogs}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      borderRadius: '8px',
                      borderColor: '#cbd5e1',
                      color: '#334155',
                      bgcolor: '#ffffff',
                      '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                    }}
                  >
                    Refresh
                  </Button>
                </Tooltip>
              </Box>
            </Box>

            {/* Bottom Toolbar Row: Filter Selects and Search Bar */}
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                flexWrap: 'wrap',
                alignItems: 'center',
                bgcolor: '#f8fafc',
                p: 1.5,
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Event Type */}
              <FormControl size="small" sx={{ minWidth: 165 }}>
                <Select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(0);
                  }}
                  displayEmpty
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #cbd5e1' },
                  }}
                >
                  <MenuItem value="all" sx={{ fontSize: '13px', fontWeight: 600 }}>All Event Types</MenuItem>
                  {eventTypes.map((type) => (
                    <MenuItem key={type} value={type} sx={{ fontSize: '13px' }}>
                      {formatEventType(type)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* User / Actor */}
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    setPage(0);
                  }}
                  displayEmpty
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #cbd5e1' },
                  }}
                >
                  <MenuItem value="all" sx={{ fontSize: '13px', fontWeight: 600 }}>All Actors / Users</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user} value={user} sx={{ fontSize: '13px' }}>{user}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Client */}
              <FormControl size="small" sx={{ minWidth: 165 }}>
                <Select
                  value={clientFilter}
                  onChange={(e) => {
                    setClientFilter(e.target.value);
                    setPage(0);
                  }}
                  displayEmpty
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #cbd5e1' },
                  }}
                >
                  <MenuItem value="all" sx={{ fontSize: '13px', fontWeight: 600 }}>All Insurance Clients</MenuItem>
                  {clients.map((client) => (
                    <MenuItem key={client} value={client} sx={{ fontSize: '13px' }}>{client}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Time Window */}
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e.target.value);
                    setPage(0);
                  }}
                  displayEmpty
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #cbd5e1' },
                  }}
                >
                  <MenuItem value="all" sx={{ fontSize: '13px', fontWeight: 600 }}>Active (90 Days)</MenuItem>
                  <MenuItem value="today" sx={{ fontSize: '13px' }}>Today</MenuItem>
                  <MenuItem value="week" sx={{ fontSize: '13px' }}>Last 7 Days</MenuItem>
                  <MenuItem value="month" sx={{ fontSize: '13px' }}>Last 30 Days</MenuItem>
                </Select>
              </FormControl>

              {/* Search Box */}
              <TextField
                placeholder="Search by case #, client, user, action or keyword..."
                size="small"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: '#94a3b8', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <Clear sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{
                  flex: 1,
                  minWidth: '240px',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    fontSize: '13px',
                    '& fieldset': { border: '1px solid #cbd5e1' },
                  },
                }}
              />
            </Box>
          </Box>

          {/* Table Container */}
          <TableContainer sx={{ minHeight: 400 }}>
            <Table sx={{ minWidth: 950 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12.5px', color: '#475569', py: 1.5, width: '130px', verticalAlign: 'middle' }}>
                    Date & Time
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12.5px', color: '#475569', py: 1.5, width: '170px', verticalAlign: 'middle' }}>
                    Event Type
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12.5px', color: '#475569', py: 1.5, width: '150px', verticalAlign: 'middle' }}>
                    Actor
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12.5px', color: '#475569', py: 1.5, width: '150px', verticalAlign: 'middle' }}>
                    Case Number
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12.5px', color: '#475569', py: 1.5, width: '170px', verticalAlign: 'middle' }}>
                    Insurance Client
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12.5px', color: '#475569', py: 1.5, width: '110px', verticalAlign: 'middle' }}>
                    Source
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12.5px', color: '#475569', py: 1.5, minWidth: '260px', verticalAlign: 'middle' }}>
                    Activity Description
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 8, textAlign: 'center', verticalAlign: 'middle' }}>
                      <CircularProgress size={32} sx={{ color: '#17539C', mb: 1.5 }} />
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Loading audit logs...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 8, textAlign: 'center', verticalAlign: 'middle' }}>
                      <Box sx={{ maxWidth: 360, mx: 'auto', textAlign: 'center' }}>
                        <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                          <History sx={{ fontSize: 30, color: '#94a3b8' }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5, fontSize: '16px' }}>
                          No Audit Logs Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', fontSize: '13px', mb: 2 }}>
                          No activity records match your selected filters or search query.
                        </Typography>
                        {hasActiveFilters && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleResetFilters}
                            startIcon={<RestartAlt />}
                            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                          >
                            Clear Filters
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((row, idx) => {
                    const eventConfig = getEventConfig(row.event_type);
                    const EventIcon = eventConfig.icon;

                    return (
                      <TableRow
                        key={`${row.event_time}-${row.event_type}-${idx}`}
                        hover
                        sx={{
                          '&:hover': { backgroundColor: '#f8fafc' },
                          transition: 'background-color 0.15s',
                          height: 56,
                        }}
                      >
                        {/* 1. Date & Time (Cleanly Aligned) */}
                        <TableCell sx={{ py: 1.25, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', lineHeight: 1.2 }}>
                            {formatDateOnly(row.event_time)}
                          </Typography>
                          <Typography sx={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, mt: 0.25 }}>
                            {formatTimeOnly(row.event_time)}
                          </Typography>
                        </TableCell>

                        {/* 2. Event Type Badge */}
                        <TableCell sx={{ py: 1.25, verticalAlign: 'middle' }}>
                          <Chip
                            size="small"
                            icon={<EventIcon sx={{ fontSize: '14px !important', color: `${eventConfig.color} !important` }} />}
                            label={eventConfig.label}
                            sx={{
                              fontWeight: 700,
                              fontSize: '11.5px',
                              color: eventConfig.color,
                              backgroundColor: eventConfig.bg,
                              border: `1px solid ${eventConfig.color}33`,
                              height: 24,
                            }}
                          />
                        </TableCell>

                        {/* 3. Actor with Avatar */}
                        <TableCell sx={{ py: 1.25, verticalAlign: 'middle' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar
                              sx={{
                                width: 26,
                                height: 26,
                                fontSize: '11.5px',
                                fontWeight: 700,
                                bgcolor: row.actor === 'System' ? '#f1f5f9' : '#e0f2fe',
                                color: row.actor === 'System' ? '#64748b' : '#0369a1',
                                border: '1px solid #cbd5e1',
                              }}
                            >
                              {(row.actor || 'S').charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography sx={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.actor || 'System'}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* 4. Case Number */}
                        <TableCell sx={{ py: 1.25, verticalAlign: 'middle' }}>
                          {row.case_number ? (
                            <Tooltip title="Click to copy case number">
                              <Chip
                                size="small"
                                label={row.case_number}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(row.case_number, `Copied ${row.case_number}`);
                                }}
                                icon={<ContentCopy sx={{ fontSize: '12px !important', color: '#1d4ed8 !important' }} />}
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  color: '#1d4ed8',
                                  bgcolor: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#dbeafe' },
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography sx={{ color: '#94a3b8', fontSize: '13px' }}>-</Typography>
                          )}
                        </TableCell>

                        {/* 5. Client Name */}
                        <TableCell sx={{ py: 1.25, verticalAlign: 'middle' }}>
                          {row.client_name ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Business sx={{ fontSize: 15, color: '#64748b', flexShrink: 0 }} />
                              <Typography
                                sx={{
                                  fontWeight: 500,
                                  fontSize: '12.5px',
                                  color: '#334155',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: 180,
                                }}
                                title={row.client_name}
                              >
                                {row.client_name}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography sx={{ color: '#94a3b8', fontSize: '13px' }}>-</Typography>
                          )}
                        </TableCell>

                        {/* 6. Source Module */}
                        <TableCell sx={{ py: 1.25, verticalAlign: 'middle' }}>
                          <Chip
                            size="small"
                            label={row.source || 'System'}
                            sx={{
                              fontSize: '11px',
                              fontWeight: 600,
                              height: 22,
                              bgcolor: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                            }}
                          />
                        </TableCell>

                        {/* 7. Activity Description (Cleanly Formatted) */}
                        <TableCell sx={{ py: 1.25, verticalAlign: 'middle' }}>
                          <RenderSmartDescription description={row.description} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Table Pagination */}
          <TablePagination
            component="div"
            count={filteredLogs.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 15, 25, 50, 100]}
            sx={{ borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}
          />
        </Paper>

        {/* Action Toast Feedback */}
        <Snackbar
          open={Boolean(toastMessage)}
          autoHideDuration={2500}
          onClose={() => setToastMessage('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setToastMessage('')} severity="success" sx={{ width: '100%', fontWeight: 600, borderRadius: '8px' }}>
            {toastMessage}
          </Alert>
        </Snackbar>
      </Box>
    </CaseManagerLayout>
  );
};

export default AuditLogsPage;
