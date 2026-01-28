import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Search, FilterList, FileDownload } from '@mui/icons-material';
import LawyerLayout from './components/LawyerLayout';

// Sample data
const sampleLogs = [
  { id: 'LOG-1005', caseId: '12342', clientName: 'Juan Doe', action: 'Accepted', initiatedBy: 'John Doe', timestamp: 'April 21, 2022 | 02:58 PM', status: 'accepted' },
  { id: 'LOG-1004', caseId: '12341', clientName: 'Alice Johnson', action: 'Rejected', subAction: 'Sent back to vendor D (mestamp A)', initiatedBy: 'defense@lawfirm.com', timestamp: 'April 21, 2022 | 11:45AM', status: 'rejected' },
  { id: 'LOG-1003', caseId: '12342', clientName: 'John Doe', action: 'Accepted', initiatedBy: 'John Doe', timestamp: 'June 16, 2022 | 11:31 AM', status: 'accepted' },
  { id: 'LOG-1002', caseId: '12341', clientName: 'Alice Johnson', action: 'Rejected', subAction: 'Sent back to Vendor D (mestamp A)', initiatedBy: 'John Doe', timestamp: 'July 27, 2022 | 12:45 PM', status: 'rejected' },
  { id: 'LOG-1001', caseId: '12342', clientName: 'John Doe', action: 'Accepted', initiatedBy: 'John Doe created', timestamp: 'July 22, 2022 | 11:30 AM', status: 'accepted' },
  { id: 'LOG-1000', caseId: '12302', clientName: 'John Doe', action: 'Real Estate', initiatedBy: 'Vendor-C@investigations.com', timestamp: 'June 22, 2022 | 11:30 AM', status: 'estate' },
  { id: 'LOG-1000', caseId: '12301', clientName: 'John Doe', action: 'Accepted', initiatedBy: 'John Doe', timestamp: 'June 22, 2022 | 11:30 AM', status: 'accepted' },
];

const LogsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return { bg: '#27ae60', color: '#fff' };
      case 'rejected':
        return { bg: '#e74c3c', color: '#fff' };
      case 'estate':
        return { bg: '#34495e', color: '#fff' };
      default:
        return { bg: '#95a5a6', color: '#fff' };
    }
  };

  const filteredLogs = sampleLogs.filter(log =>
    log.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.caseId.includes(searchTerm) ||
    log.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <LawyerLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Home / Logs
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#2c3e50', mb: 3 }}>
            Logs
          </Typography>
        </Box>

        <Paper sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <TextField
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1, maxWidth: 600 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                sx={{ borderColor: '#34495e', color: '#34495e' }}
              >
                Filter
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownload />}
                sx={{ borderColor: '#34495e', color: '#34495e' }}
              >
                Export
              </Button>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: '#3498db',
                  '&:hover': { backgroundColor: '#2980b9' },
                }}
              >
                + New Logs
              </Button>
            </Box>
          </Box>

          <Box sx={{ p: 2 }}>
            <Button
              variant="text"
              startIcon={<FilterList />}
              sx={{ mb: 2, color: '#34495e' }}
            >
              Advanced filter →
            </Button>

            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: '#f8f9fa' }}>
                  <TableRow>
                    <TableCell><strong>ID</strong></TableCell>
                    <TableCell><strong>Case ID</strong></TableCell>
                    <TableCell><strong>Client Name</strong></TableCell>
                    <TableCell><strong>Action</strong></TableCell>
                    <TableCell><strong>Initiated By</strong></TableCell>
                    <TableCell><strong>Timestamp</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const statusStyle = getStatusColor(log.status);
                    return (
                      <TableRow key={`${log.id}-${log.caseId}`} hover>
                        <TableCell>{log.id}</TableCell>
                        <TableCell>{log.caseId}</TableCell>
                        <TableCell>{log.clientName}</TableCell>
                        <TableCell>
                          <Box>
                            <Chip
                              label={log.action}
                              size="small"
                              sx={{
                                backgroundColor: statusStyle.bg,
                                color: statusStyle.color,
                                fontWeight: 500,
                              }}
                            />
                            {log.subAction && (
                              <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>
                                {log.subAction}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{log.initiatedBy}</TableCell>
                        <TableCell>{log.timestamp}</TableCell>
                        <TableCell>
                          <Button
                            variant="contained"
                            size="small"
                            sx={{
                              backgroundColor: '#34495e',
                              '&:hover': { backgroundColor: '#2c3e50' },
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

            {filteredLogs.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">No logs found</Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 3 }}>
              <Button variant="outlined" size="small">Prev</Button>
              <Button variant="contained" size="small">1</Button>
              <Button variant="outlined" size="small">2</Button>
              <Button variant="outlined" size="small">3</Button>
              <Button variant="outlined" size="small">Next →</Button>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
              Showing 1 to 6 of 108 log entries
            </Typography>
          </Box>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          © 2024 Lawyer Portal. All rights reserved.
        </Typography>
      </Box>
    </LawyerLayout>
  );
};

export default LogsPage;
