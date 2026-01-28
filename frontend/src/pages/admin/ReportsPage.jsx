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
  Avatar,
} from '@mui/material';
import {
  Search,
  Description,
  SearchOutlined,
  NoteAlt,
  FolderOpen,
  Add,
  ChevronRight,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';

// Demo data for stats
const statsData = [
  {
    title: 'Total Reports',
    value: 2421,
    change: 188,
    icon: Description,
    iconBgColor: '#e3f2fd',
  },
  {
    title: 'Investigation Reports',
    value: 974,
    change: 84,
    icon: SearchOutlined,
    iconBgColor: '#e8f5e9',
  },
  {
    title: 'Authorization Forms',
    value: 863,
    change: 19,
    icon: NoteAlt,
    iconBgColor: '#fff3e0',
  },
  {
    title: 'Other Documents',
    value: 584,
    change: -15,
    icon: FolderOpen,
    iconBgColor: '#f3e5f5',
  },
];

// Demo data for reports table
const reportsData = [
  {
    id: '#1250',
    type: 'Investigation Report for Hit-and-Run Incident',
    title: 'Dynamic Claims LLC',
    generated: '1 hour ago',
    vendor: 'Dynamic Claims LLC',
  },
  {
    id: '#1249',
    type: 'Authorization Form: John Smith Odynamic, CBui',
    title: 'Apex Investigations',
    generated: '1 day ago',
    vendor: 'Smith Investigation',
  },
  {
    id: '#1238',
    type: 'Authorization Form: Mark Lee (Metro Detective',
    title: 'API Security Services',
    generated: '1 day ago',
    vendor: 'API Security Services',
  },
  {
    id: '#1184',
    type: 'Authorization Form: Anna Miller (Miller & Asso',
    title: 'Global Security Inc.',
    generated: '2 days ago',
    vendor: 'Legal Detective Agency',
  },
  {
    id: '#1176',
    type: 'Investigation Report for Two-Car Accident',
    title: 'Legal Detective Agency',
    generated: '6 days ago',
    vendor: 'Apex Investigations',
  },
  {
    id: '#1165',
    type: 'Authorization Form: Robert Johnson (Global Se',
    title: 'Global Security Inc.',
    generated: '6 days ago',
    vendor: 'SecureGuard Inc.',
  },
];

const ReportsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = reportsData.map((n) => n.id);
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
    setReportTypeFilter('all');
    setVendorFilter('all');
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          Reports
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, width: '100%' }}>
        {statsData.map((stat, index) => (
          <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
            <StatCard 
              {...stat} 
              change={stat.change > 0 ? ((stat.change / stat.value) * 100).toFixed(1) : stat.change}
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
        {/* Filters and Search */}
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#333' }}>
              All Reports
            </Typography>

            {/* Report Type Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={reportTypeFilter}
                onChange={(e) => setReportTypeFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Report Types</MenuItem>
                <MenuItem value="investigation">Investigation</MenuItem>
                <MenuItem value="authorization">Authorization</MenuItem>
                <MenuItem value="other">Other</MenuItem>
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
                <MenuItem value="dynamic">Dynamic Claims LLC</MenuItem>
                <MenuItem value="apex">Apex Investigations</MenuItem>
                <MenuItem value="smith">Smith Investigation</MenuItem>
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
              placeholder="Search reports, case IDs..."
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

            {/* Generate Report Button */}
            <Button
              variant="contained"
              startIcon={<Add />}
              sx={{
                backgroundColor: '#667eea',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                px: 2.5,
                '&:hover': { backgroundColor: '#5568d3' },
              }}
            >
              Generate Report
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
                    indeterminate={selected.length > 0 && selected.length < reportsData.length}
                    checked={reportsData.length > 0 && selected.length === reportsData.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Case ID
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Type
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Title
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Generated
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Assigned Vendor
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportsData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
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
                      <Typography sx={{ fontSize: '14px', color: '#333' }}>
                        {row.type}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#333' }}>
                        {row.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#666' }}>
                        {row.generated}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#333' }}>
                        {row.vendor}
                      </Typography>
                    </TableCell>
                    <TableCell>
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
                        View
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
            1-8 of 2,421
          </Typography>
          <TablePagination
            component="div"
            count={2421}
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

export default ReportsPage;
