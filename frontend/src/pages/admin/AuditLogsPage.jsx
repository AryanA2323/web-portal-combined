import { useState } from 'react';
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
  TablePagination,
  InputAdornment,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Search,
  Description,
  Person,
  Settings,
  Shield,
  FileDownload,
  MoreVert,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
// Charts will be added later

// Demo data for stats
const statsData = [
  {
    title: 'Total Log Entries',
    value: 3582,
    change: -208,
    icon: Description,
    iconBgColor: '#e3f2fd',
  },
  {
    title: '1274 User Activities',
    value: 1274,
    change: 96,
    icon: Person,
    iconBgColor: '#e8f5e9',
  },
  {
    title: '854 System Events',
    value: 854,
    change: 33,
    icon: Settings,
    iconBgColor: '#fff3e0',
  },
  {
    title: '187 Security Alerts',
    value: 187,
    change: 10,
    icon: Shield,
    iconBgColor: '#ffebee',
  },
];

// Bar chart data
const barChartData = [
  { month: 'Jan', 'User Activity': 400, 'System Event': 300, 'Security Alert': 100, Events: 150 },
  { month: 'Feb', 'User Activity': 1000, 'System Event': 650, 'Security Alert': 600, Events: 200 },
  { month: 'Mar', 'User Activity': 600, 'System Event': 700, 'Security Alert': 550, Events: 350 },
  { month: 'Apr', 'User Activity': 650, 'System Event': 850, 'Security Alert': 600, Events: 500 },
  { month: 'May', 'User Activity': 400, 'System Event': 650, 'Security Alert': 250, Events: 150 },
  { month: 'Jun', 'User Activity': 850, 'System Event': 950, 'Security Alert': 600, Events: 650 },
];

// Demo data for audit logs table
const auditLogsData = [
  {
    id: 1,
    date: 'Apr 26, 2024',
    type: 'User Activity',
    typeColor: '#4c6ef5',
    typeIcon: '⊕',
    user: 'John Doe',
    description: 'Case #1289 assigned to Metro Detective Agency',
    ipAddress: '192.168.1.10',
    entity: 'Case #1249',
    entityLink: true,
  },
  {
    id: 2,
    date: 'Apr 26, 2024',
    type: 'User Activity',
    typeColor: '#4c6ef5',
    typeIcon: '⊕',
    user: 'John Doe',
    description: 'Authorization form generated for Case #1249',
    ipAddress: '192.168.1.10',
    entity: 'Case #1249',
    entityLink: true,
  },
  {
    id: 3,
    date: 'Apr 22, 2024',
    type: 'System Event',
    typeColor: '#51cf66',
    typeIcon: '✓',
    user: 'System',
    description: 'Reminder email sent to Metro Detective Agency for Case #192.168.1.5',
    ipAddress: '192.168.1.5',
    entity: 'Case #1225',
    entityLink: true,
  },
  {
    id: 4,
    date: 'Apr 22, 2024',
    type: 'Security Alert',
    typeColor: '#ff6b6b',
    typeIcon: '⬛',
    user: 'John Doe',
    description: 'Suspicious login attempt detected for John Smith',
    ipAddress: '209.0.113.45',
    entity: 'User #252',
    entityLink: true,
  },
  {
    id: 5,
    date: 'Apr 22, 2024',
    type: 'User Activity',
    typeColor: '#4c6ef5',
    typeIcon: '⊕',
    user: 'Jane Smith',
    description: 'Vendor SafeGuard Security registered',
    ipAddress: '209.0.119.56',
    entity: 'SafeGuard Security',
    entityLink: false,
  },
  {
    id: 6,
    date: 'Apr 21, 2024',
    type: 'System Event',
    typeColor: '#51cf66',
    typeIcon: '✓',
    user: 'System',
    description: 'Case #1247 marked as overdue',
    ipAddress: '192.168.1.5',
    entity: 'Case #1217',
    entityLink: true,
  },
  {
    id: 7,
    date: 'Apr 21, 2024',
    type: 'System Event',
    typeColor: '#51cf66',
    typeIcon: '✓',
    user: 'John Doe',
    description: 'Investigation report generated for Case #1184',
    ipAddress: '192.168.1.10',
    entity: 'Case #1184',
    entityLink: true,
  },
];

const AuditLogsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = auditLogsData.map((n) => n.id);
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
    setSearchTerm('');
    setTypeFilter('all');
    setUserFilter('all');
    setDateRange('all');
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  const getTypeChip = (type, typeColor, typeIcon) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '4px',
            backgroundColor: `${typeColor}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
          }}
        >
          {typeIcon}
        </Box>
        <Typography sx={{ fontSize: '14px', color: typeColor, fontWeight: 500 }}>
          {type}
        </Typography>
      </Box>
    );
  };

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          Audit Logs
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

      {/* Chart Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
          Log Activity Overview
        </Typography>
        <Box sx={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <Typography sx={{ color: '#999' }}>Bar Chart - Log Activity Overview</Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{ display: 'block', textAlign: 'center', mt: 1, color: '#666' }}
        >
          + 3,582 log entries
        </Typography>
      </Paper>

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
            <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#333' }}>
              All
            </Typography>

            {/* Type Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">Types</MenuItem>
                <MenuItem value="user">User Activity</MenuItem>
                <MenuItem value="system">System Event</MenuItem>
                <MenuItem value="security">Security Alert</MenuItem>
              </Select>
            </FormControl>

            {/* User Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Users</MenuItem>
                <MenuItem value="john">John Doe</MenuItem>
                <MenuItem value="jane">Jane Smith</MenuItem>
                <MenuItem value="system">System</MenuItem>
              </Select>
            </FormControl>

            {/* Date Range Filter */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">Date Range</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
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

            {/* Search */}
            <TextField
              placeholder="Search logs..."
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

            {/* Export Logs Button */}
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
            >
              Export Logs
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
                    indeterminate={selected.length > 0 && selected.length < auditLogsData.length}
                    checked={auditLogsData.length > 0 && selected.length === auditLogsData.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Date
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Type
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  User
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Description
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  IP Address
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Entity
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLogsData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
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
                      <Typography sx={{ fontSize: '14px', color: '#333' }}>
                        {row.date}
                      </Typography>
                    </TableCell>
                    <TableCell>{getTypeChip(row.type, row.typeColor, row.typeIcon)}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#333' }}>
                        {row.user}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#333' }}>
                        {row.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#666' }}>
                        {row.ipAddress}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.entityLink ? (
                        <Typography
                          sx={{
                            fontSize: '14px',
                            color: '#667eea',
                            fontWeight: 500,
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {row.entity}
                        </Typography>
                      ) : (
                        <Typography sx={{ fontSize: '14px', color: '#333' }}>
                          {row.entity}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <MoreVert sx={{ fontSize: 20, color: '#999' }} />
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
            py: 1.5,
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <Typography sx={{ fontSize: '14px', color: '#666' }}>
            1-8 of 3,532
          </Typography>
          <TablePagination
            component="div"
            count={3532}
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

export default AuditLogsPage;
