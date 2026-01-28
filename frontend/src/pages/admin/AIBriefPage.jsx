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
  TrendingUp,
  Schedule,
  CheckCircle,
  ChevronRight,
  History,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';

// Demo data for stats
const statsData = [
  {
    title: 'Total AI Briefs',
    value: 914,
    change: 244,
    icon: Description,
    iconBgColor: '#e3f2fd',
  },
  {
    title: 'Accuracy Rate',
    value: '92.3%',
    change: -0.5,
    icon: TrendingUp,
    iconBgColor: '#fff3e0',
  },
  {
    title: 'Pending Review',
    value: 56,
    change: 7,
    icon: Schedule,
    iconBgColor: '#fff8e1',
  },
  {
    title: 'Approved Briefs',
    value: 829,
    change: 251,
    icon: CheckCircle,
    iconBgColor: '#e8f5e9',
  },
];

// Demo data for AI brief review table
const aiBriefData = [
  {
    id: '#1248',
    summary: 'AI -a-scened, a white van stiuked an parked car.',
    vendor: 'Smith Investigation',
    vendorAvatar: 'S',
    generated: '3 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
    actionStatus: 'Review',
    actionColor: '#51cf66',
  },
  {
    id: '#1242',
    summary: 'Fraudulent claim of rear-ended accident',
    vendor: 'Elite etjer Barts',
    vendorAvatar: 'E',
    generated: '3 days ago',
    status: 'Pending Review',
    statusColor: '#ff922b',
    actionStatus: 'Review',
    actionColor: '#51cf66',
  },
  {
    id: '#1240',
    summary: 'Embezzadment allegation.',
    vendor: 'Metro Detective Agency',
    vendorAvatar: 'M',
    generated: '2 days ago',
    status: 'AI Brief. ago',
    statusColor: '#999',
    actionStatus: 'Review',
    actionColor: '#51cf66',
  },
  {
    id: '#1238',
    summary: 'Two-car accident on Maple Jive.',
    vendor: 'Willer & Associates',
    vendorAvatar: 'W',
    generated: '2 days ago',
    status: 'AI Brief. ago',
    statusColor: '#999',
    actionStatus: 'Edit',
    actionColor: '#ff922b',
  },
  {
    id: '#1229',
    summary: 'Man caught shoplifting and fled on foot.',
    vendor: 'Metro Associates',
    vendorAvatar: 'M',
    generated: '2 days ago',
    status: 'AI Brief. ago',
    statusColor: '#999',
    actionStatus: 'Edit',
    actionColor: '#ff922b',
  },
  {
    id: '#1178',
    summary: 'Fail at local grocery store.',
    vendor: 'Global Security Inc',
    vendorAvatar: 'G',
    generated: '2 days ago',
    status: 'AI Brief. ago',
    statusColor: '#999',
    actionStatus: 'Edit',
    actionColor: '#ff922b',
  },
];

const AIBriefPage = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = aiBriefData.map((n) => n.id);
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
          AI Brief Review
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, width: '100%' }}>
        {statsData.map((stat, index) => (
          <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
            <StatCard 
              {...stat} 
              change={typeof stat.value === 'string' ? stat.change : ((stat.change / (typeof stat.value === 'number' ? stat.value : 100)) * 100).toFixed(1)}
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
              AI Brief Review Queue
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
                <MenuItem value="fraud">Fraud</MenuItem>
                <MenuItem value="accident">Accident</MenuItem>
                <MenuItem value="theft">Theft</MenuItem>
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
                <MenuItem value="metro">Metro Detective Agency</MenuItem>
                <MenuItem value="global">Global Security Inc</MenuItem>
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
                    indeterminate={selected.length > 0 && selected.length < aiBriefData.length}
                    checked={aiBriefData.length > 0 && selected.length === aiBriefData.length}
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
                  Assigned Vendor
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Generated
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Status
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
              {aiBriefData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
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
                        {row.generated}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={row.status === 'Pending Review' ? <Schedule sx={{ fontSize: 16 }} /> : undefined}
                        label={row.status}
                        size="small"
                        sx={{
                          backgroundColor: row.status === 'Pending Review' ? `${row.statusColor}15` : 'transparent',
                          color: row.statusColor,
                          fontWeight: 500,
                          fontSize: '12px',
                          height: '26px',
                          borderRadius: '6px',
                          border: row.status === 'Pending Review' ? 'none' : '1px solid #e0e0e0',
                          '& .MuiChip-icon': {
                            color: row.statusColor,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={row.actionStatus === 'Review' ? <CheckCircle sx={{ fontSize: 16 }} /> : undefined}
                        label={row.actionStatus}
                        size="small"
                        sx={{
                          backgroundColor: `${row.actionColor}15`,
                          color: row.actionColor,
                          fontWeight: 500,
                          fontSize: '12px',
                          height: '26px',
                          borderRadius: '6px',
                          '& .MuiChip-icon': {
                            color: row.actionColor,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        size="small"
                        endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
                        sx={{
                          backgroundColor: '#667eea',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '13px',
                          borderRadius: '6px',
                          minWidth: '80px',
                          '&:hover': { backgroundColor: '#5568d3' },
                        }}
                      >
                        Review
                      </Button>
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
            1-8 of 914
          </Typography>
          <TablePagination
            component="div"
            count={914}
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

export default AIBriefPage;
