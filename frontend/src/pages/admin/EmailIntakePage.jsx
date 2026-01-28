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
  IconButton,
  Chip,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import {
  Search,
  Add,
  MoreVert,
  Email,
  Warning,
  Schedule,
  CheckCircle,
  ChevronRight,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';

// Demo data for stats
const statsData = [
  {
    title: 'Total Email Cases',
    value: 387,
    change: 15.9,
    icon: Email,
    iconBgColor: '#e3f2fd',
  },
  {
    title: 'Parsed Cases',
    value: 286,
    change: 12.7,
    icon: Warning,
    iconBgColor: '#fff3e0',
  },
  {
    title: 'Pending Review',
    value: 72,
    change: 12.8,
    icon: Schedule,
    iconBgColor: '#fff8e1',
  },
  {
    title: 'Unable to Parse',
    value: 29,
    change: -9.4,
    icon: Warning,
    iconBgColor: '#ffebee',
  },
];

// Demo data for email intake table
const emailIntakeData = [
  {
    id: 1,
    from: 'Kevin Wilson',
    email: 'kev-nwelson@dfaaranoce.com',
    subject: 'Suspicious Activity Case #1248',
    caseType: '',
    status: 'Pending Review',
    statusColor: '#f6ad55',
    vendor: 'Smith Investigation',
    received: '2 days ago',
    hasReview: true,
  },
  {
    id: 2,
    from: 'david.nyguen@netros-',
    email: 'david.nguyet@elitetodetective.com',
    subject: 'Info for Case #1242',
    caseType: 'Forensic',
    status: 'Pending Review',
    statusColor: '#f6ad55',
    vendor: 'Metro Detective Agency',
    received: '2 days ago',
    hasReview: true,
  },
  {
    id: 3,
    from: 'omity.carter@eliteinvestigators.net',
    email: 'sintro.make@eliteinvestigatorsi.tak',
    subject: 'Embezzlement Case #1240',
    caseType: 'Forensic',
    status: 'Parsed',
    statusColor: '#48bb78',
    vendor: 'Elite Investigators',
    received: '3 days ago',
    hasReview: false,
  },
  {
    id: 4,
    from: 'apexinvestigations@email.com',
    email: 'support@poteguard.com - 2int@artafical.com',
    subject: 'Incident Report #1236 - Contract Dispute',
    caseType: 'Forensic',
    status: 'Parsed',
    statusColor: '#48bb78',
    vendor: 'Miller & Associates',
    received: '2 days ago',
    hasReview: false,
  },
  {
    id: 5,
    from: 'SafeGuard Security',
    email: 'suppon@arditessclated.com',
    subject: 'Follow-up Evidence for Theft Inquiry',
    caseType: 'Forensic',
    status: 'Parsed',
    statusColor: '#48bb78',
    vendor: 'City Watch Services',
    received: '2 days ago',
    hasReview: false,
  },
  {
    id: 6,
    from: 'diana.patel@smith investigation.com',
    email: 'cintermanporalit.om',
    subject: 'New Claim Notification',
    caseType: 'Forensic',
    status: 'Parsed',
    statusColor: '#48bb78',
    vendor: 'Siphrrip.rrall',
    received: '2 days ago',
    hasReview: false,
  },
  {
    id: 7,
    from: 'Michael Brown-milleaaefraudcheck.com',
    email: 'tom.parkere@msirametraudcheck.com',
    subject: 'Background Check',
    caseType: 'Forensic',
    status: 'Parsed',
    statusColor: '#48bb78',
    vendor: 'Michael Brown 11n1r',
    received: '2 days ago',
    hasReview: false,
  },
  {
    id: 8,
    from: 'tom.parker@insurancefraudcheck.com',
    email: 'tom.parker@rsiranecraud.int',
    subject: 'Insurance Fraud',
    caseType: 'Forensic',
    status: 'Parsed',
    statusColor: '#48bb78',
    vendor: 'Insurance Fraud',
    received: '2 days ago',
    hasReview: false,
  },
  {
    id: 9,
    from: 'noreply@cybersecure.net',
    email: 'norepty@cybersecure.net',
    subject: 'Unauthorized Login Attempt',
    caseType: 'Forensic',
    status: 'Unable to Parse',
    statusColor: '#f56565',
    vendor: 'Cybersecure',
    received: '2 days ago',
    hasReview: false,
  },
];

const EmailIntakePage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState('all');
  const [caseTypeFilter2, setCaseTypeFilter2] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = emailIntakeData.map((n) => n.id);
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
    setStatusFilter('all');
    setVendorFilter('all');
    setCaseTypeFilter('all');
    setCaseTypeFilter2('all');
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  const getStatusChip = (status, statusColor) => {
    const isError = status === 'Unable to Parse';
    return (
      <Chip
        icon={
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isError ? '#f56565' : statusColor,
              ml: 1,
            }}
          />
        }
        label={status}
        size="small"
        sx={{
          backgroundColor: isError ? '#fff5f5' : `${statusColor}15`,
          color: isError ? '#c53030' : statusColor === '#48bb78' ? '#22543d' : '#c05621',
          fontWeight: 500,
          fontSize: '12px',
          height: '26px',
          borderRadius: '6px',
          border: isError ? '1px solid #feb2b2' : 'none',
          '& .MuiChip-icon': {
            marginLeft: '8px',
          },
        }}
      />
    );
  };

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          Email Intake
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
                <MenuItem value="parsed">Parsed</MenuItem>
                <MenuItem value="unable">Unable to Parse</MenuItem>
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
                <MenuItem value="forensic">Forensic</MenuItem>
                <MenuItem value="fraud">Fraud</MenuItem>
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
                <MenuItem value="elite">Elite Investigators</MenuItem>
              </Select>
            </FormControl>

            {/* Case Type Filter 2 */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={caseTypeFilter2}
                onChange={(e) => setCaseTypeFilter2(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Case Types</MenuItem>
                <MenuItem value="forensic">Forensic</MenuItem>
                <MenuItem value="fraud">Fraud</MenuItem>
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

            {/* New Case Button */}
            <Button
              variant="contained"
              startIcon={<Add />}
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
                    indeterminate={selected.length > 0 && selected.length < emailIntakeData.length}
                    checked={emailIntakeData.length > 0 && selected.length === emailIntakeData.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>From</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Case Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Vendor</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Received</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {emailIntakeData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
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
                      <Box>
                        <Typography
                          sx={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#333',
                          }}
                        >
                          {row.from}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '12px',
                            color: '#999',
                          }}
                        >
                          {row.email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography sx={{ fontSize: '14px', color: '#333' }}>{row.subject}</Typography>
                        {row.caseType && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontSize: '11px',
                                color: '#666',
                              }}
                            >
                              📎 {row.caseType}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.caseType && (
                        <Typography sx={{ fontSize: '14px', color: '#333' }}></Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(row.status, row.statusColor)}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#333' }}>{row.vendor}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '14px', color: '#666' }}>
                        {row.received}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.hasReview ? (
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
                          Review
                        </Button>
                      ) : (
                        <IconButton size="small">
                          <MoreVert sx={{ fontSize: 20, color: '#999' }} />
                        </IconButton>
                      )}
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
            1-{Math.min(rowsPerPage, emailIntakeData.length)} of 387
          </Typography>
          <TablePagination
            component="div"
            count={387}
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

export default EmailIntakePage;
