import { useState, useEffect } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  Search,
  Add,
  MoreVert,
  FolderOpen,
  Schedule,
  CheckCircle,
  Warning,
  PersonPin,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
import CreateCaseDialog from './components/CreateCaseDialog';
import api from '../../services/api';

// Status color mapping
const statusColors = {
  'OPEN': '#4299e1',
  'IN_PROGRESS': '#f6ad55',
  'PENDING': '#9f7aea',
  'RESOLVED': '#48bb78',
  'CLOSED': '#48bb78',
  'CANCELLED': '#a0aec0',
};

const statusLabels = {
  'OPEN': 'New',
  'IN_PROGRESS': 'In Progress',
  'PENDING': 'Pending',
  'RESOLVED': 'Resolved',
  'CLOSED': 'Completed',
  'CANCELLED': 'Cancelled',
};

// Priority color mapping
const priorityColors = {
  'low': '#48bb78',
  'medium': '#ed8936',
  'high': '#f56565',
  'critical': '#e53e3e',
};

const CasesPage = () => {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [investigatorFilter, setInvestigatorFilter] = useState('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCases, setTotalCases] = useState(0);
  const [selected, setSelected] = useState([]);
  const [assigningVendor, setAssigningVendor] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, statusFilter, caseTypeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats and cases in parallel
      const [statsRes, casesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/cases', {
          params: {
            page: page + 1,
            page_size: rowsPerPage,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            category: caseTypeFilter !== 'all' ? caseTypeFilter : undefined,
            search: searchTerm || undefined,
          }
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
  const handleCreateCase = async (caseData) => {
    try {
      await api.post('/cases', caseData);
      
      // Refresh cases list
      await fetchData();
    } catch (error) {
      console.error('Failed to create case:', error);
      throw error;
    }
  };

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

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="under_review">Under Review</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
              </Select>
            </FormControl>

            {/* Vendor Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Vendors</MenuItem>
                <MenuItem value="smith">Smith Investigation</MenuItem>
                <MenuItem value="metro">Metro Detective Agency</MenuItem>
              </Select>
            </FormControl>

            {/* Investigator Filter */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={investigatorFilter}
                onChange={(e) => setInvestigatorFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Investigators</MenuItem>
                <MenuItem value="diana">Diana Patel</MenuItem>
                <MenuItem value="david">David Nguyen</MenuItem>
              </Select>
            </FormControl>

            {/* Case Type Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={caseTypeFilter}
                onChange={(e) => { setCaseTypeFilter(e.target.value); setPage(0); }}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Categories</MenuItem>
                <MenuItem value="Motor">Motor</MenuItem>
                <MenuItem value="Health">Health</MenuItem>
                <MenuItem value="Fire">Fire</MenuItem>
                <MenuItem value="Marine">Marine</MenuItem>
                <MenuItem value="Liability">Liability</MenuItem>
                <MenuItem value="Engineering">Engineering</MenuItem>
                <MenuItem value="Miscellaneous">Miscellaneous</MenuItem>
              </Select>
            </FormControl>

            {/* Clear Filters */}
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setVendorFilter('all');
                setInvestigatorFilter('all');
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
              onClick={() => setOpenDialog(true)}
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
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Case ID</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Case Title</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Priority</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Insured Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Assigned Vendor</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px' }}>Last Updated</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map((row) => {
                const isItemSelected = isSelected(row.id);
                const status = row.status || 'new';
                const statusColor = statusColors[status] || statusColors.new;
                const statusLabel = statusLabels[status] || status;
                const priority = row.priority || 'medium';
                const priorityColor = priorityColors[priority] || priorityColors.medium;
                
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
                        #{row.case_number || row.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px' }}>{row.title || 'Untitled Case'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabel}
                        size="small"
                        sx={{
                          backgroundColor: `${statusColor}15`,
                          color: statusColor,
                          fontWeight: 600,
                          fontSize: '12px',
                          height: '24px',
                          borderRadius: '6px',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: priorityColor,
                          }}
                        />
                        <Typography sx={{ fontSize: '14px', textTransform: 'capitalize' }}>{priority}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px' }}>{row.category || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px' }}>{row.insured_name || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.assigned_vendor ? (
                          <Chip
                            label={row.assigned_vendor}
                            size="small"
                            sx={{
                              backgroundColor: '#e8f5e9',
                              color: '#2e7d32',
                              fontWeight: 600,
                              fontSize: '12px',
                              height: '24px',
                              borderRadius: '6px',
                            }}
                          />
                        ) : (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={assigningVendor === row.id ? <CircularProgress size={14} /> : <PersonPin />}
                            onClick={() => handleAutoAssignVendor(row.id)}
                            disabled={assigningVendor === row.id || !row.latitude || !row.longitude}
                            sx={{
                              textTransform: 'none',
                              fontSize: '12px',
                              borderRadius: '6px',
                              borderColor: '#667eea',
                              color: '#667eea',
                              '&:hover': {
                                borderColor: '#5568d3',
                                backgroundColor: '#f0f4ff',
                              },
                            }}
                          >
                            {assigningVendor === row.id ? 'Assigning...' : 'Auto Assign'}
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#666' }}>
                        {formatDate(row.updated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <MoreVert sx={{ fontSize: 20 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
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

      <CreateCaseDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSuccess={handleCreateCase}
      />
    </AdminLayout>
  );
};

export default CasesPage;
