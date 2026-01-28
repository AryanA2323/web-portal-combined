import { useState } from 'react';
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
} from '@mui/material';
import {
  Description,
  Schedule,
  CheckCircle,
  Cancel,
  ChevronRight,
  History,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';

// Demo data for stats
const statsData = [
  {
    title: 'Total Reports',
    value: 586,
    change: 152,
    icon: Description,
    iconBgColor: '#e3f2fd',
  },
  {
    title: 'Pending Review',
    value: 27,
    change: -5,
    icon: Schedule,
    iconBgColor: '#fff3e0',
  },
  {
    title: 'Approved Reports',
    value: 529,
    change: 137,
    icon: CheckCircle,
    iconBgColor: '#e8f5e9',
  },
  {
    title: 'Rejected Reports',
    value: 30,
    change: -10,
    icon: Cancel,
    iconBgColor: '#ffebee',
  },
];



// Demo data for legal review table
const legalReviewData = [
  {
    id: '#1248',
    summary: 'Al-generated summary of a hit-and-run involving a word van striking parked car.',
    vendor: 'Smith Investigation',
    vendorAvatar: 'S',
    submitted: '3 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
  },
  {
    id: '#1242',
    summary: 'Fraudulent claim of rear-ended accent.',
    vendor: 'Miller & Associates',
    vendorAvatar: 'M',
    submitted: '2 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
  },
  {
    id: '#1240',
    summary: 'Embasslement allegp.',
    vendor: 'Metro Detective Agency',
    vendorAvatar: 'M',
    submitted: '2 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
  },
  {
    id: '#1239',
    summary: 'Two car accident on Mopic Ave.',
    vendor: 'API-Security Services',
    vendorAvatar: 'A',
    submitted: '2 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
  },
  {
    id: '#1178',
    summary: 'Man caught shoplifting and fled on foot.',
    vendor: 'Global Security Inc',
    vendorAvatar: 'G',
    submitted: '2 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
  },
  {
    id: '#1176',
    summary: 'Uinauthored login attempts to a secure server.',
    vendor: 'Apex Investigations',
    vendorAvatar: 'A',
    submitted: '2 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
  },
  {
    id: '#1165',
    summary: '',
    vendor: 'SecureGuard Inc.',
    vendorAvatar: 'S',
    submitted: '6 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
  },
];

const LegalReviewPage = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = legalReviewData.map((n) => n.id);
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
    setCaseTypeFilter('all');
    setVendorFilter('all');
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          Legal Review
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, width: '100%' }}>
        {statsData.map((stat, index) => (
          <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
            <StatCard 
              {...stat} 
              change={stat.change > 0 ? ((stat.change / stat.value) * 100).toFixed(1) : ((stat.change / stat.value) * 100).toFixed(1)}
            />
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
                <MenuItem value="pending">Pending Review</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>

            {/* Case Type Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={caseTypeFilter}
                onChange={(e) => setCaseTypeFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Case Types</MenuItem>
                <MenuItem value="investigation">Investigation</MenuItem>
                <MenuItem value="fraud">Fraud</MenuItem>
                <MenuItem value="accident">Accident</MenuItem>
              </Select>
            </FormControl>

            {/* Vendor Filter */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
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
                <MenuItem value="miller">Miller & Associates</MenuItem>
                <MenuItem value="metro">Metro Detective Agency</MenuItem>
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
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < legalReviewData.length}
                    checked={legalReviewData.length > 0 && selected.length === legalReviewData.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Case ID
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Summary
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Vendor
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Submitted
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
              {legalReviewData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
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
                        {row.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#333', maxWidth: 400 }}>
                        {row.summary}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '14px',
                            backgroundColor: '#667eea',
                          }}
                        >
                          {row.vendorAvatar}
                        </Avatar>
                        <Typography sx={{ fontSize: '14px', color: '#333' }}>
                          {row.vendor}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#666' }}>
                        {row.submitted}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<Schedule sx={{ fontSize: 16 }} />}
                        label={row.status}
                        size="small"
                        sx={{
                          backgroundColor: `${row.statusColor}15`,
                          color: row.statusColor,
                          fontWeight: 500,
                          fontSize: '12px',
                          height: '26px',
                          borderRadius: '6px',
                          '& .MuiChip-icon': {
                            color: row.statusColor,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
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
                        <Button
                          variant="outlined"
                          size="small"
                          endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
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
                          Assign
                        </Button>
                      </Box>
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
            py: 1.5,
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <Typography sx={{ fontSize: '14px', color: '#666' }}>
            1-6 of 536
          </Typography>
          <TablePagination
            component="div"
            count={536}
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
    </AdminLayout>
  );
};

export default LegalReviewPage;
