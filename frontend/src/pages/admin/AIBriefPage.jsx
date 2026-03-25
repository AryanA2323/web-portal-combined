import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  ChevronRight,
  Description,
  Download,
  Schedule,
  TrendingUp,
  UploadFile,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
import api from '../../services/api';
import jsPDF from 'jspdf';

const REPORT_STORAGE_KEY = 'aiBriefReports';

const irStatusColors = {
  Open: '#4299e1',
  Approval: '#f6ad55',
  Stop: '#f56565',
  QC: '#9f7aea',
  Dispatch: '#48bb78',
};

const reportStatusColors = {
  Generated: '#48bb78',
  'Pending Report': '#ff922b',
};

const loadStoredReports = () => {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredReports = (reports) => {
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
};

const formatRelativeDate = (value) => {
  if (!value) return 'Not generated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not generated';

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
};

const extractAssignedVendor = (row) => {
  const subItem = (row.sub_items || []).find((item) => item.assigned_vendor_name);
  return subItem?.assigned_vendor_name || 'Unassigned';
};

const extractSummary = (row) => {
  const summary = (row.sub_items || []).find((item) => item.statement)?.statement;
  if (summary) return summary;
  if (row.accident_brief) return row.accident_brief;
  if (row.description) return row.description;
  return 'No incident summary available yet.';
};

const AIBriefPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cases, setCases] = useState([]);
  const [totalCases, setTotalCases] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);
  const [reportsByCase, setReportsByCase] = useState(() => loadStoredReports());
  const [activeReportCaseId, setActiveReportCaseId] = useState(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [viewReportDialogOpen, setViewReportDialogOpen] = useState(false);
  const [statementFile, setStatementFile] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    saveStoredReports(reportsByCase);
  }, [reportsByCase]);

  // Migrate localStorage reports to database on mount
  useEffect(() => {
    const migrateReports = async () => {
      const storedReports = loadStoredReports();
      const reportEntries = Object.entries(storedReports);

      if (reportEntries.length === 0) return;

      const reportsToMigrate = reportEntries.map(([caseId, report]) => ({
        case_id: parseInt(caseId, 10),
        report_content: report.reportText || '',
      })).filter(r => r.report_content);

      if (reportsToMigrate.length === 0) return;

      try {
        const result = await api.post('/reports/bulk', { reports: reportsToMigrate });
        console.log('Reports migration result:', result.data);
      } catch (err) {
        console.error('Failed to migrate reports to database:', err);
      }
    };

    migrateReports();
  }, []);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchCases();
  }, [page, rowsPerPage, statusFilter, caseTypeFilter, vendorFilter, vendors]);

  const fetchVendors = async () => {
    try {
      const response = await api.get('/check-vendors');
      setVendors(response.data || []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    }
  };

  const fetchCases = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/cases/incident-db', {
        params: {
          page: page + 1,
          page_size: rowsPerPage,
          investigation_report_status: statusFilter !== 'all' ? statusFilter : undefined,
          case_type: caseTypeFilter !== 'all' ? caseTypeFilter : undefined,
          assigned_vendor_name:
            vendorFilter !== 'all'
              ? vendors.find((vendor) => String(vendor.id) === String(vendorFilter))?.company_name || undefined
              : undefined,
        },
      });

      setCases(response.data.cases || []);
      setTotalCases(response.data.total || 0);
      setSelected([]);
    } catch (err) {
      console.error('Failed to fetch AI brief cases:', err);
      setError('Failed to load AI brief review data.');
      setCases([]);
      setTotalCases(0);
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    return cases.map((row) => {
      const report = reportsByCase[row.id];
      const vendorName = extractAssignedVendor(row);
      const summary = extractSummary(row);

      return {
        ...row,
        summary,
        vendorName,
        vendorAvatar: vendorName?.charAt(0)?.toUpperCase() || 'U',
        reportStatus: report ? 'Generated' : 'Pending Report',
        reportGeneratedAt: report?.generatedAt || null,
      };
    });
  }, [cases, reportsByCase]);

  const selectedCase = useMemo(
    () => rows.find((row) => String(row.id) === String(selected[0])) || null,
    [rows, selected]
  );

  const activeReport = activeReportCaseId ? reportsByCase[activeReportCaseId] : null;
  const activeReportCase = activeReportCaseId
    ? rows.find((row) => String(row.id) === String(activeReportCaseId)) || null
    : null;

  const statsData = useMemo(() => {
    const generatedCount = rows.filter((row) => reportsByCase[row.id]).length;
    const assignedVendorsCount = new Set(
      rows.filter((row) => row.vendorName && row.vendorName !== 'Unassigned').map((row) => row.vendorName)
    ).size;
    const dispatchCount = rows.filter((row) => row.investigation_report_status === 'Dispatch').length;

    return [
      {
        title: 'Total Cases',
        value: totalCases,
        change: 0,
        icon: Description,
        iconBgColor: '#e3f2fd',
      },
      {
        title: 'Generated Reports',
        value: generatedCount,
        change: 0,
        icon: AutoAwesome,
        iconBgColor: '#ede7f6',
      },
      {
        title: 'Assigned Vendors',
        value: assignedVendorsCount,
        change: 0,
        icon: TrendingUp,
        iconBgColor: '#fff3e0',
      },
      {
        title: 'Dispatch Cases',
        value: dispatchCount,
        change: 0,
        icon: CheckCircle,
        iconBgColor: '#e8f5e9',
      },
    ];
  }, [rows, reportsByCase, totalCases]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelected(rows.map((row) => row.id));
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

  const handleChangePage = (_, newPage) => {
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
    setPage(0);
  };

  const openGenerateDialog = () => {
    if (selected.length !== 1) {
      setError('Select exactly one case to generate a report.');
      return;
    }
    setStatementFile(null);
    setReportDialogOpen(true);
  };

  const closeGenerateDialog = () => {
    if (generating) return;
    setReportDialogOpen(false);
    setStatementFile(null);
  };

  const handleGenerateReport = async () => {
    if (!selectedCase) {
      setError('No case selected for report generation.');
      return;
    }
    if (!statementFile) {
      setError('Upload a vendor statement PDF before generating the report.');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      setSuccess('');

      const formData = new FormData();
      formData.append('statement_pdf', statementFile);

      const response = await api.post(
        `/cases/incident-db/${selectedCase.id}/ai-brief-report`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const reportRecord = {
        caseId: response.data.case_id,
        caseNumber: response.data.case_number,
        reportText: response.data.report_text,
        statementExcerpt: response.data.statement_excerpt,
        generatedAt: new Date().toISOString(),
        sourceFileName: statementFile.name,
      };

      // Save report to database for legal review
      try {
        await api.post('/reports', {
          case_id: selectedCase.id,
          report_content: response.data.report_text,
        });
      } catch (saveErr) {
        console.error('Failed to save report to database:', saveErr);
        // Continue even if save fails - report is still in localStorage
      }

      setReportsByCase((prev) => ({
        ...prev,
        [selectedCase.id]: reportRecord,
      }));
      setActiveReportCaseId(selectedCase.id);
      setReportDialogOpen(false);
      setStatementFile(null);
      setViewReportDialogOpen(true);
      setSuccess(`AI brief report generated for case ${response.data.case_number}.`);
    } catch (err) {
      console.error('Failed to generate AI brief report:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to generate AI brief report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    if (!activeReport || !activeReportCase) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    const addText = (text, fontSize, isBold, color) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      if (color) doc.setTextColor(color[0], color[1], color[2]);
      else doc.setTextColor(30, 30, 30);

      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.5;
      }
    };

    // Header
    addText('AI Brief Report', 18, true, [102, 126, 234]);
    y += 4;

    // Meta info
    const caseNum = activeReport.caseNumber || activeReportCase.case_number || 'N/A';
    addText(`Case Number: ${caseNum}`, 11, true);
    addText(`Claim Number: ${activeReportCase.claim_number || 'N/A'}`, 11, false);
    addText(`Vendor: ${activeReportCase.vendorName || 'Unassigned'}`, 11, false);
    addText(`Generated: ${new Date(activeReport.generatedAt).toLocaleString()}`, 11, false);
    addText(`Source PDF: ${activeReport.sourceFileName || 'N/A'}`, 11, false);
    y += 4;

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Report body - parse sections
    const reportText = activeReport.reportText || '';
    const bodyLines = reportText.split('\n');
    for (const line of bodyLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        y += 4;
        continue;
      }
      // Section headers (lines ending with colon like "Vendor Statement Summary:")
      if (/^[A-Z].*:$/.test(trimmed) && !trimmed.startsWith('-')) {
        y += 2;
        addText(trimmed, 13, true, [51, 65, 85]);
        y += 1;
      } else {
        addText(trimmed, 10, false);
      }
    }

    const fileName = `${caseNum}_AI_Brief_Report.pdf`;
    doc.save(fileName);
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          AI Brief Review
        </Typography>
      </Box>

      {(error || success) && (
        <Box sx={{ mb: 3 }}>
          {error ? (
            <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: '10px' }}>
              {error}
            </Alert>
          ) : null}
          {success ? (
            <Alert severity="success" onClose={() => setSuccess('')} sx={{ borderRadius: '10px', mt: error ? 2 : 0 }}>
              {success}
            </Alert>
          ) : null}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, width: '100%' }}>
        {statsData.map((stat, index) => (
          <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
            <StatCard {...stat} change={stat.change} />
          </Box>
        ))}
      </Box>

      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#333' }}>
              AI Brief Review Queue
            </Typography>

            <FormControl size="small" sx={{ minWidth: 150 }}>
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
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="Approval">Approval</MenuItem>
                <MenuItem value="QC">QC</MenuItem>
                <MenuItem value="Dispatch">Dispatch</MenuItem>
                <MenuItem value="Stop">Stop</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
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
                <MenuItem value="Full Case">Full Case</MenuItem>
                <MenuItem value="Partial Case">Partial Case</MenuItem>
                <MenuItem value="Reassessment">Reassessment</MenuItem>
                <MenuItem value="Connected Case">Connected Case</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
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
                {vendors.map((vendor) => (
                  <MenuItem key={vendor.id} value={String(vendor.id)}>
                    {vendor.company_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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

            <Button
              variant="contained"
              startIcon={<AutoAwesome />}
              onClick={openGenerateDialog}
              disabled={selected.length !== 1}
              sx={{
                ml: 'auto',
                backgroundColor: '#667eea',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                px: 2.5,
                '&:hover': { backgroundColor: '#5568d3' },
                '&.Mui-disabled': {
                  backgroundColor: '#c5cae9',
                  color: '#fff',
                },
              }}
            >
              Generate Report
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < rows.length}
                    checked={rows.length > 0 && selected.length === rows.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Case ID</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Summary</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Assigned Vendor</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Generated</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>IR Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Report Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 6, textAlign: 'center' }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography sx={{ color: '#666' }}>No AI brief cases found for the current filters.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const rowSelected = isSelected(row.id);
                  const report = reportsByCase[row.id];
                  const irColor = irStatusColors[row.investigation_report_status] || '#78909c';
                  const reportColor = reportStatusColors[row.reportStatus] || '#999';

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ '&:last-child td': { border: 0 }, cursor: 'pointer' }}
                      onClick={() => {
                        if (report) {
                          setActiveReportCaseId(row.id);
                          setViewReportDialogOpen(true);
                        }
                      }}
                    >
                      <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                        <Checkbox checked={rowSelected} onChange={() => handleSelect(row.id)} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: '#667eea', fontWeight: 600, fontSize: '14px' }}>
                          {row.case_number || `#${row.id}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', color: '#333', maxWidth: 420 }}>
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
                              backgroundColor: row.vendorName === 'Unassigned' ? '#b0bec5' : '#667eea',
                            }}
                          >
                            {row.vendorAvatar}
                          </Avatar>
                          <Typography sx={{ fontSize: '14px', color: '#333' }}>{row.vendorName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '14px', color: '#666' }}>
                          {formatRelativeDate(row.reportGeneratedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<Schedule sx={{ fontSize: 16 }} />}
                          label={row.investigation_report_status || 'Open'}
                          size="small"
                          sx={{
                            backgroundColor: `${irColor}15`,
                            color: irColor,
                            fontWeight: 500,
                            fontSize: '12px',
                            height: '26px',
                            borderRadius: '6px',
                            '& .MuiChip-icon': { color: irColor },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={report ? <CheckCircle sx={{ fontSize: 16 }} /> : undefined}
                          label={row.reportStatus}
                          size="small"
                          sx={{
                            backgroundColor: `${reportColor}15`,
                            color: reportColor,
                            fontWeight: 500,
                            fontSize: '12px',
                            height: '26px',
                            borderRadius: '6px',
                            '& .MuiChip-icon': { color: reportColor },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          endIcon={<ChevronRight sx={{ fontSize: 16 }} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (report) {
                              setActiveReportCaseId(row.id);
                              setViewReportDialogOpen(true);
                            } else {
                              setSelected([row.id]);
                            }
                          }}
                          sx={{
                            backgroundColor: '#667eea',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '13px',
                            borderRadius: '6px',
                            minWidth: '104px',
                            '&:hover': { backgroundColor: '#5568d3' },
                          }}
                        >
                          {report ? 'View Report' : 'Select Case'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

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
            {rows.length === 0 ? '0 results' : `${page * rowsPerPage + 1}-${Math.min(page * rowsPerPage + rows.length, totalCases)} of ${totalCases}`}
          </Typography>
          <TablePagination
            component="div"
            count={totalCases}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            sx={{ '& .MuiTablePagination-select': { borderRadius: '6px' } }}
          />
        </Box>
      </Paper>

      <Dialog open={reportDialogOpen} onClose={closeGenerateDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Generate AI Brief Report</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: '14px', color: '#475569', mb: 2 }}>
            {selectedCase
              ? `Upload the vendor statement PDF for case ${selectedCase.case_number || selectedCase.id}. AI will generate a concise vendor summary, incident summary, and review notes.`
              : 'Select a case first.'}
          </Typography>

          <Box
            sx={{
              border: '1px dashed #cbd5e1',
              borderRadius: '10px',
              p: 2,
              backgroundColor: '#f8fafc',
            }}
          >
            <Button component="label" variant="outlined" startIcon={<UploadFile />} sx={{ textTransform: 'none' }}>
              Upload Vendor Statement PDF
              <input
                hidden
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setStatementFile(event.target.files?.[0] || null)}
              />
            </Button>
            <Typography sx={{ mt: 1.5, fontSize: '14px', color: '#475569' }}>
              {statementFile ? statementFile.name : 'No PDF selected yet.'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeGenerateDialog} disabled={generating} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateReport}
            disabled={generating || !statementFile}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {generating ? <CircularProgress size={20} color="inherit" /> : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={viewReportDialogOpen}
        onClose={() => setViewReportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            AI Brief Report
            {activeReportCase && (
              <Typography sx={{ fontSize: '14px', color: '#666', fontWeight: 400 }}>
                Case: {activeReportCase.case_number || activeReportCase.id}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleDownloadReport}
            disabled={!activeReport}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
            }}
          >
            Download
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {activeReport && activeReportCase ? (
            <Box>
              <Typography sx={{ fontSize: '13px', color: '#64748b', mb: 2 }}>
                Source PDF: {activeReport.sourceFileName} | Generated {formatRelativeDate(activeReport.generatedAt)}
              </Typography>
              <Box
                sx={{
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  p: 2.5,
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    lineHeight: 1.7,
                    color: '#1e293b',
                  }}
                >
                  {activeReport.reportText}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography sx={{ color: '#64748b', textAlign: 'center', py: 4 }}>
              No report data available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setViewReportDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

export default AIBriefPage;
