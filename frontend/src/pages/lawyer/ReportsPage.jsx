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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
} from '@mui/material';
import { Search, Description } from '@mui/icons-material';
import LawyerLayout from './components/LawyerLayout';

// Sample data
const sampleReports = [
  { id: 'PR-1001', clientName: 'Jane Smith', caseType: 'Contract Dispute', submittedOn: 'June 24, 2022', vendor: 'Vendor A', status: 'pending' },
  { id: 'PR-1002', clientName: 'ACME Corp.', caseType: 'Business Litigation', submittedOn: 'June 23, 2022', vendor: 'Vendor B', status: 'pending' },
  { id: 'PR-1003', clientName: 'John Doe', caseType: 'Real Estate', submittedOn: 'June 22, 2022', vendor: 'Vendor C', status: 'pending' },
  { id: 'PR-1004', clientName: 'Juan Doe', caseType: 'Personal Injury', submittedOn: 'April 21, 2022', vendor: 'Vendor D', status: 'reviewed' },
  { id: 'PR-1005', clientName: 'Alice Johnson', caseType: 'Family Law', submittedOn: 'April 21, 2022', vendor: 'Vendor E', status: 'reviewed' },
];

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [rejectReason, setRejectReason] = useState('vendor');

  const handleReview = (report) => {
    setSelectedReport(report);
    setReviewDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setReviewDialogOpen(false);
    setSelectedReport(null);
    setRejectReason('vendor');
  };

  const handleAccept = () => {
    console.log('Accepting report:', selectedReport);
    handleCloseDialog();
  };

  const handleReject = () => {
    console.log('Rejecting report:', selectedReport, 'Reason:', rejectReason);
    handleCloseDialog();
  };

  const filteredReports = sampleReports.filter(report => {
    const matchesSearch = report.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.caseType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 0 ? report.status === 'pending' : report.status === 'reviewed';
    return matchesSearch && matchesTab;
  });

  return (
    <LawyerLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Home / Reports
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#2c3e50' }}>
            Reports
          </Typography>
        </Box>

        <Paper sx={{ overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{
              backgroundColor: '#34495e',
              '& .MuiTab-root': { color: '#ecf0f1', fontWeight: 600 },
              '& .Mui-selected': { color: '#3498db' },
            }}
          >
            <Tab label="Pending Review" />
            <Tab label="Reviewed" />
          </Tabs>

          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: '#f8f9fa' }}>
                  <TableRow>
                    <TableCell><strong>ID</strong></TableCell>
                    <TableCell><strong>Client Name</strong></TableCell>
                    <TableCell><strong>Case Type</strong></TableCell>
                    <TableCell><strong>Submitted On</strong></TableCell>
                    <TableCell><strong>Vendor</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id} hover>
                      <TableCell>{report.id}</TableCell>
                      <TableCell>{report.clientName}</TableCell>
                      <TableCell>{report.caseType}</TableCell>
                      <TableCell>{report.submittedOn}</TableCell>
                      <TableCell>{report.vendor}</TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleReview(report)}
                          sx={{
                            backgroundColor: '#34495e',
                            '&:hover': { backgroundColor: '#2c3e50' },
                          }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {filteredReports.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">No reports found</Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
              <Button variant="outlined" size="small">Prev</Button>
              <Button variant="contained" size="small">1</Button>
              <Button variant="outlined" size="small">2</Button>
              <Button variant="outlined" size="small">Next</Button>
            </Box>
          </Box>
        </Paper>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description sx={{ color: '#34495e' }} />
            Review Report
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 3 }}>
              Please review the report data submitted by the vendor and select an action:
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Send Rejected Report To:</InputLabel>
              <Select
                value={rejectReason}
                label="Send Rejected Report To:"
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <MenuItem value="vendor">Vendor (send back for revision)</MenuItem>
                <MenuItem value="archive">Archive</MenuItem>
                <MenuItem value="other">Other Lawyer...</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleCloseDialog} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              variant="contained"
              sx={{
                backgroundColor: '#e74c3c',
                '&:hover': { backgroundColor: '#c0392b' },
              }}
            >
              Reject Report
            </Button>
            <Button
              onClick={handleAccept}
              variant="contained"
              sx={{
                backgroundColor: '#27ae60',
                '&:hover': { backgroundColor: '#229954' },
              }}
            >
              Accept Report
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LawyerLayout>
  );
};

export default ReportsPage;
