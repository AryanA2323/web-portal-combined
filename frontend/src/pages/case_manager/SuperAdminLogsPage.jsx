import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Menu,
} from '@mui/material';
import {
  History,
  Person,
  Assignment,
  FolderOpen,
  GroupAdd,
  ArrowDropDown,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import superAdminService from '../../services/superAdminService';
import AlertMessage from '../../components/common/AlertMessage';
import { NotificationBell } from '../../components/case_manager';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const getActionIcon = (action) => {
  switch (action) {
    case 'CASE_CREATED':
      return <FolderOpen sx={{ fontSize: 18, color: '#2563eb' }} />;
    case 'REPORT_GENERATED':
      return <Assignment sx={{ fontSize: 18, color: '#16a34a' }} />;
    case 'QC_ASSIGNED':
      return <Person sx={{ fontSize: 18, color: '#9333ea' }} />;
    case 'VENDOR_ASSIGNED':
      return <GroupAdd sx={{ fontSize: 18, color: '#ea580c' }} />;
    default:
      return <History sx={{ fontSize: 18, color: '#6366f1' }} />;
  }
};

const getActionChip = (action) => {
  switch (action) {
    case 'CASE_CREATED':
      return <Chip label="Case Created" size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '11px' }} />;
    case 'REPORT_GENERATED':
      return <Chip label="Report Generated" size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '11px' }} />;
    case 'QC_ASSIGNED':
      return <Chip label="QC Assigned" size="small" sx={{ bgcolor: '#f3e8ff', color: '#7e22ce', fontWeight: 700, fontSize: '11px' }} />;
    case 'VENDOR_ASSIGNED':
      return <Chip label="Partner Assigned" size="small" sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 700, fontSize: '11px' }} />;
    default:
      return <Chip label={action || 'Activity'} size="small" sx={{ bgcolor: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: '11px' }} />;
  }
};

const SuperAdminLogsPage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCmId, setSelectedCmId] = useState(location.state?.cmId || '');
  const [timeFilterAnchorEl, setTimeFilterAnchorEl] = useState(null);
  const [timeFilter, setTimeFilter] = useState('');
  const [timeMenuAnchorEl, setTimeMenuAnchorEl] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  const fetchDashboardData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      const data = await superAdminService.getSuperAdminDashboard();
      setDashboardData(data);
      if (data?.case_managers && data.case_managers.length > 0) {
        setSelectedCmId((prev) => (prev ? prev : (location.state?.cmId || data.case_managers[0].id)));
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch logs data:', err);
      setError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useAutoRefresh(fetchDashboardData);

  const { case_managers = [], activity_logs = [] } = dashboardData || {};

  const activeCm = case_managers.find((cm) => String(cm.id) === String(selectedCmId)) || case_managers[0];

  const cmLogs = activity_logs.filter((log) => {
    const matchesCm = activeCm ? String(log.user_id) === String(activeCm.id) : true;
    if (!matchesCm) return false;
    
    if (timeFilter || fromTime || toTime) {
      const logDate = new Date(log.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const logDateOnly = new Date(logDate);
      logDateOnly.setHours(0, 0, 0, 0);

      if (timeFilter === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (logDateOnly.getTime() !== yesterday.getTime()) return false;
      } else if (timeFilter === '2_days_ago') {
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        if (logDateOnly.getTime() !== twoDaysAgo.getTime()) return false;
      } else if (timeFilter === '3_days_ago') {
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        if (logDateOnly.getTime() !== threeDaysAgo.getTime()) return false;
      } else if (timeFilter === 'custom') {
        // Date part
        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          if (logDateOnly < from) return false;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(0, 0, 0, 0);
          if (logDateOnly > to) return false;
        }
      }

      // Time part: apply independently of date filter
      const hours = logDate.getHours().toString().padStart(2, '0');
      const minutes = logDate.getMinutes().toString().padStart(2, '0');
      const logTimeStr = `${hours}:${minutes}`;
      
      if (fromTime && logTimeStr < fromTime) return false;
      if (toTime && logTimeStr > toTime) return false;
    }
    
    return true;
  });

  return (
    <CaseManagerLayout>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <History sx={{ fontSize: 32, color: '#6366f1' }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
                Case Manager Activity Logs
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '13px' }}>
                View complete activity timeline for each Case Manager
              </Typography>
            </Box>
          </Box>
          <NotificationBell />
        </Box>

        <AlertMessage severity="error" message={error} open={!!error} onClose={() => setError('')} />

        {/* Filter Controls Row */}
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="cm-select-label">Select Case Manager</InputLabel>
            <Select
              labelId="cm-select-label"
              value={selectedCmId || (activeCm?.id || '')}
              label="Select Case Manager"
              onChange={(e) => setSelectedCmId(e.target.value)}
              sx={{ borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}
            >
              {case_managers?.map((cm) => (
                <MenuItem key={cm.id} value={cm.id}>
                  {cm.name || cm.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* Date Filter Dropdown */}
            <Box>
              <Button
                variant="outlined"
                onClick={(e) => setTimeFilterAnchorEl(e.currentTarget)}
                endIcon={<ArrowDropDown />}
                sx={{ borderRadius: '10px', height: '40px', fontWeight: 600, color: '#1a1a1a', borderColor: '#c4c4c4', minWidth: 160, justifyContent: 'space-between', textTransform: 'none' }}
              >
                {timeFilter === 'yesterday' ? 'Yesterday' : timeFilter === '2_days_ago' ? '2 days ago' : timeFilter === '3_days_ago' ? '3 days ago' : timeFilter === 'custom' ? 'Custom Date' : 'Date Filter'}
              </Button>
              <Menu
                anchorEl={timeFilterAnchorEl}
                open={Boolean(timeFilterAnchorEl)}
                onClose={() => setTimeFilterAnchorEl(null)}
                PaperProps={{ sx: { borderRadius: '12px', mt: 1, minWidth: 160 } }}
              >
                <MenuItem onClick={() => { setTimeFilter('yesterday'); setTimeFilterAnchorEl(null); }}>Yesterday</MenuItem>
                <MenuItem onClick={() => { setTimeFilter('2_days_ago'); setTimeFilterAnchorEl(null); }}>2 days ago</MenuItem>
                <MenuItem onClick={() => { setTimeFilter('3_days_ago'); setTimeFilterAnchorEl(null); }}>3 days ago</MenuItem>
                <MenuItem 
                  onClick={(e) => { 
                    setTimeFilter('custom'); 
                  }}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minHeight: '48px', backgroundColor: timeFilter === 'custom' ? 'rgba(0, 0, 0, 0.04)' : 'transparent', whiteSpace: 'normal', minWidth: timeFilter === 'custom' ? '320px' : 'auto' }}
                >
                  <Box sx={{ width: '100%', py: 0.5 }}>Custom Date</Box>
                  {timeFilter === 'custom' && (
                    <Box 
                      onClick={(e) => e.stopPropagation()} 
                      onKeyDown={(e) => e.stopPropagation()}
                      sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, width: '100%', pb: 1 }}
                    >
                      <TextField size="small" type="date" label="From Date" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                      <TextField size="small" type="date" label="To Date" InputLabelProps={{ shrink: true }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </Box>
                  )}
                </MenuItem>
              </Menu>
            </Box>

            {/* Time Filter Dropdown */}
            <Box>
              <Button
                variant="outlined"
                onClick={(e) => setTimeMenuAnchorEl(e.currentTarget)}
                endIcon={<ArrowDropDown />}
                sx={{ borderRadius: '10px', height: '40px', fontWeight: 600, color: '#1a1a1a', borderColor: '#c4c4c4', minWidth: 160, justifyContent: 'space-between', textTransform: 'none' }}
              >
                {fromTime || toTime ? 'Custom Time' : 'Time Filter'}
              </Button>
              <Menu
                anchorEl={timeMenuAnchorEl}
                open={Boolean(timeMenuAnchorEl)}
                onClose={() => setTimeMenuAnchorEl(null)}
                PaperProps={{ sx: { borderRadius: '12px', mt: 1, minWidth: 320 } }}
              >
                <MenuItem 
                  onClick={(e) => e.stopPropagation()}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minHeight: '48px', backgroundColor: 'transparent', whiteSpace: 'normal' }}
                >
                  <Box sx={{ width: '100%', py: 0.5 }}>Custom Time</Box>
                  <Box 
                    onClick={(e) => e.stopPropagation()} 
                    onKeyDown={(e) => e.stopPropagation()}
                    sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, width: '100%', pb: 1 }}
                  >
                    <TextField size="small" type="time" label="From Time" InputLabelProps={{ shrink: true }} value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
                    <TextField size="small" type="time" label="To Time" InputLabelProps={{ shrink: true }} value={toTime} onChange={(e) => setToTime(e.target.value)} />
                  </Box>
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {(timeFilter || fromTime || toTime) && (
            <Box sx={{ display: 'flex', flex: 1, justifyContent: 'flex-end' }}>
              <Button 
                variant="text" 
                color="error" 
                onClick={() => { setTimeFilter(''); setFromDate(''); setToDate(''); setFromTime(''); setToTime(''); }}
                sx={{ textTransform: 'none', fontWeight: 600, minWidth: '100px' }}
              >
                Clear Filters
              </Button>
            </Box>
          )}
        </Paper>

        {/* Activity Logs Table */}
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Activity Details</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Performed By</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} />
                    </TableCell>
                  </TableRow>
                ) : cmLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#94a3b8', fontStyle: 'italic' }}>
                      No activity logs found for the selected Case Manager.
                    </TableCell>
                  </TableRow>
                ) : (
                  cmLogs.map((log) => (
                    <TableRow key={log.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getActionIcon(log.action)}
                          {getActionChip(log.action)}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                          {log.details}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                          {log.actor}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '11px' }}>
                          {log.role || 'Case Manager'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 2 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '12px' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </CaseManagerLayout>
  );
};

export default SuperAdminLogsPage;
