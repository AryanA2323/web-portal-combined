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
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  ChevronRight,
  Delete,
  Description,
  Download,
  Refresh,
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

const getEvidencePhotoUrl = (photo) => {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.preview_url || photo.url || photo.photo_url || '';
};

const resolveEvidencePhotoUrl = (photoUrl) => {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('data:')) return photoUrl;
  if (photoUrl.startsWith('http')) {
    try {
      const parsedUrl = new URL(photoUrl);
      if (parsedUrl.pathname.startsWith('/media/')) {
        return `${parsedUrl.pathname}${parsedUrl.search || ''}`;
      }
    } catch {
      return photoUrl;
    }
    return photoUrl;
  }
  if (photoUrl.startsWith('/media/')) return photoUrl;
  if (photoUrl.startsWith('media/')) return `/${photoUrl}`;
  return `/media/${photoUrl.replace(/^\/+/, '')}`;
};

const getImageDataUrl = async (photo) => {
  const imgSrc = resolveEvidencePhotoUrl(getEvidencePhotoUrl(photo));
  if (!imgSrc) return null;

  const response = await fetch(imgSrc);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [lawyers, setLawyers] = useState([]);
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteReportDialogOpen, setDeleteReportDialogOpen] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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
    fetchLawyers();
  }, []);

  useEffect(() => {
    fetchCases();
  }, [page, rowsPerPage, statusFilter, caseTypeFilter, vendorFilter, vendors]);

  const fetchLawyers = async () => {
    try {
      const response = await api.get('/lawyers');
      setLawyers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch lawyers:', err);
    }
  };

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

      // Save report to database for legal review
      let reportId = null;
      try {
        const saveResponse = await api.post('/reports', {
          case_id: selectedCase.id,
          report_content: response.data.report_text,
        });
        reportId = saveResponse.data.id;
      } catch (saveErr) {
        console.error('Failed to save report to database:', saveErr);
        // Continue even if save fails - report is still in localStorage
      }

      const reportRecord = {
        id: reportId,
        caseId: response.data.case_id,
        caseNumber: response.data.case_number,
        reportText: response.data.report_text,
        statementExcerpt: response.data.statement_excerpt,
        evidencePhotos: response.data.evidence_photos || [],
        generatedAt: new Date().toISOString(),
        sourceFileName: statementFile.name,
      };

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

  const handleDownloadReport = async () => {
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

    const addImage = async (photo, caption = '') => {
      // Check if we need a new page
      if (y > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage();
        y = 20;
      }

      try {
        const imageDataUrl = await getImageDataUrl(photo);
        if (!imageDataUrl) return;
        const imageFormat = imageDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(imageDataUrl, imageFormat, margin, y, maxWidth, 80);
        y += 90; // Height of image + spacing

        if (caption) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100, 100, 100);
          const captionLines = doc.splitTextToSize(`Caption: ${caption}`, maxWidth);
          for (const line of captionLines) {
            if (y > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, margin, y);
            y += 4;
          }
          y += 4;
        }
      } catch (err) {
        console.error('Failed to add image to PDF:', err);
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
      // Section headers: all caps words without colons (e.g. "CASE INFORMATION", "CLAIMANT STATEMENT")
      // This regex matches lines that are all uppercase letters and spaces/hyphens
      if (/^[A-Z\s-]+$/.test(trimmed) && trimmed.length > 3) {
        y += 2;
        addText(trimmed, 13, true, [51, 65, 85]);
        y += 1;
      } else {
        addText(trimmed, 10, false);
      }
    }

    // Add evidence photos section
    const evidencePhotos = activeReport.evidencePhotos || [];
    if (evidencePhotos.length > 0) {
      y += 8;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      addText('VENDOR EVIDENCE', 13, true, [51, 65, 85]);
      y += 6;

      for (const photo of evidencePhotos) {
        await addImage(photo, '');
      }
    }

    const fileName = `${caseNum}_AI_Brief_Report.pdf`;
    doc.save(fileName);
  };

  const handleEditReport = async () => {
    if (activeReport) {
      // If report doesn't have an ID, first save it to database
      if (!activeReport.id) {
        setSubmitting(true);
        try {
          const saveResponse = await api.post('/reports', {
            case_id: activeReport.caseId,
            report_content: activeReport.reportText,
          });
          
          // Update the report with the database ID
          const updatedReport = {
            ...activeReport,
            id: saveResponse.data.id,
          };
          
          setReportsByCase((prev) => ({
            ...prev,
            [activeReportCaseId]: updatedReport,
          }));
          
          setEditedContent(activeReport.reportText);
          setEditMode(true);
          setSuccess('Report saved to database. You can now edit.');
        } catch (err) {
          console.error('Failed to save report to database:', err);
          setError('Could not save report to database. Please try again.');
        } finally {
          setSubmitting(false);
        }
      } else {
        setEditedContent(activeReport.reportText);
        setEditMode(true);
      }
    }
  };

  const handleSaveReport = async () => {
    if (!activeReport || !editedContent.trim()) {
      setError('Report content cannot be empty.');
      return;
    }

    if (!activeReport.id) {
      setError('Report ID is missing. Please close and reopen the report.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.put(`/reports/${activeReport.id}/content`, {
        report_content: editedContent,
      });

      // Update the local report
      setReportsByCase((prev) => ({
        ...prev,
        [activeReportCaseId]: {
          ...prev[activeReportCaseId],
          reportText: editedContent,
        },
      }));

      setEditMode(false);
      setSuccess('Report updated successfully.');
    } catch (err) {
      console.error('Failed to save report:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to save report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignLawyer = async () => {
    if (!activeReport || !selectedLawyer) {
      setError('Please select a lawyer to assign.');
      return;
    }

    // If report doesn't have an ID, save it first
    let reportId = activeReport.id;
    if (!reportId) {
      setSubmitting(true);
      try {
        const saveResponse = await api.post('/reports', {
          case_id: activeReport.caseId,
          report_content: activeReport.reportText,
        });
        reportId = saveResponse.data.id;
        
        // Update the report with the database ID
        const updatedReport = {
          ...activeReport,
          id: reportId,
        };
        setReportsByCase((prev) => ({
          ...prev,
          [activeReportCaseId]: updatedReport,
        }));
      } catch (err) {
        console.error('Failed to save report to database:', err);
        setError('Could not save report to database before assignment. Please try again.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const response = await api.post(`/reports/${reportId}/assign`, {
        lawyer_id: selectedLawyer.id,
      });

      setSelectedLawyer(null);
      setViewReportDialogOpen(false);
      setSuccess(`Report assigned to ${selectedLawyer.full_name} successfully.`);
      fetchCases();
    } catch (err) {
      console.error('Failed to assign lawyer:', err);
      setError(err.response?.data?.detail || 'Failed to assign lawyer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete AI brief report handler
  const handleDeleteReport = async () => {
    if (!activeReport) return;

    try {
      setDeletingReport(true);
      setError('');

      if (activeReport.id) {
        // Delete from database
        await api.delete(`/reports/${activeReport.id}`);
      }

      // Remove from local state
      setReportsByCase((prev) => {
        const updated = { ...prev };
        delete updated[activeReportCaseId];
        return updated;
      });

      setDeleteReportDialogOpen(false);
      setViewReportDialogOpen(false);
      setActiveReportCaseId(null);
      setSuccess(`AI brief report for case ${activeReportCase?.case_number || activeReportCaseId} deleted successfully.`);
      fetchCases();
    } catch (err) {
      console.error('Failed to delete report:', err);
      setError(err.response?.data?.detail || 'Failed to delete report.');
    } finally {
      setDeletingReport(false);
    }
  };

  // Regenerate AI brief report handler
  const handleRegenerateReport = async () => {
    if (!activeReportCase) return;

    try {
      setRegenerating(true);
      setError('');

      // For now, show a message that they need to upload a new statement
      setViewReportDialogOpen(false);
      setSelected([activeReportCase.id]);
      setReportDialogOpen(true);
      setSuccess('Please upload a new vendor statement PDF to regenerate the report.');
    } catch (err) {
      console.error('Failed to prepare regenerate:', err);
      setError('Failed to prepare report regeneration.');
    } finally {
      setRegenerating(false);
    }
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
        onClose={() => {
          setViewReportDialogOpen(false);
          setEditMode(false);
          setSelectedLawyer(null);
        }}
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
            disabled={!activeReport || editMode}
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
              
              {editMode ? (
                <TextField
                  multiline
                  fullWidth
                  rows={15}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  variant="outlined"
                  sx={{
                    borderRadius: '10px',
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'inherit',
                      fontSize: '14px',
                    },
                  }}
                />
              ) : (
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
              )}

              {!editMode && activeReport.evidencePhotos && activeReport.evidencePhotos.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Vendor Evidence
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 2,
                      maxHeight: '500px',
                      overflowY: 'auto',
                    }}
                  >
                    {activeReport.evidencePhotos.map((photo, idx) => {
                      const photoUrl = getEvidencePhotoUrl(photo);
                      return (
                        <Box
                          key={idx}
                          sx={{
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                          }}
                        >
                          <img
                            src={resolveEvidencePhotoUrl(photoUrl)}
                            alt={`Vendor Evidence ${idx + 1}`}
                            style={{
                              width: '100%',
                              height: 'auto',
                              maxHeight: '250px',
                              objectFit: 'cover',
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {!editMode && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Assign to Lawyer for Review
                  </Typography>
                  <FormControl fullWidth>
                    <Select
                      value={selectedLawyer?.id || ''}
                      onChange={(e) => {
                        const lawyer = lawyers.find((l) => l.id === e.target.value);
                        setSelectedLawyer(lawyer);
                      }}
                      displayEmpty
                      sx={{ mb: 2 }}
                    >
                      <MenuItem value="">Select a lawyer</MenuItem>
                      {lawyers.map((lawyer) => (
                        <MenuItem key={lawyer.id} value={lawyer.id}>
                          {lawyer.full_name} ({lawyer.email})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Box>
          ) : (
            <Typography sx={{ color: '#64748b', textAlign: 'center', py: 4 }}>
              No report data available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setViewReportDialogOpen(false);
              setEditMode(false);
              setSelectedLawyer(null);
            }}
            sx={{ textTransform: 'none' }}
          >
            {editMode ? 'Cancel Edit' : 'Close'}
          </Button>
          {editMode && (
            <Button
              variant="contained"
              onClick={handleSaveReport}
              disabled={submitting || !editedContent.trim()}
              sx={{
                backgroundColor: '#667eea',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#5568d3' },
              }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
            </Button>
          )}
          {!editMode && (
            <>
              <Button
                variant="outlined"
                startIcon={<Delete />}
                onClick={() => setDeleteReportDialogOpen(true)}
                disabled={!activeReport || submitting}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: '#f56565',
                  color: '#f56565',
                  '&:hover': { backgroundColor: '#ffe0e0' },
                }}
              >
                Delete Report
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRegenerateReport}
                disabled={!activeReport || submitting}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': { backgroundColor: '#f0f4ff' },
                }}
              >
                Regenerate Report
              </Button>
              <Button
                variant="outlined"
                onClick={handleEditReport}
                disabled={submitting}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': { backgroundColor: '#f0f4ff' },
                }}
              >
                Edit Report
              </Button>
              <Button
                variant="contained"
                onClick={handleAssignLawyer}
                disabled={submitting || !selectedLawyer}
                sx={{
                  backgroundColor: '#667eea',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#5568d3' },
                }}
              >
                {submitting ? <CircularProgress size={20} color="inherit" /> : 'Assign to Lawyer'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Report Confirmation Dialog */}
      <Dialog
        open={deleteReportDialogOpen}
        onClose={() => setDeleteReportDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1 }}>
          Delete AI Brief Report
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#666', mb: 2 }}>
            Are you sure you want to delete the AI brief report for case <strong>{activeReportCase?.case_number}</strong>?
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#999' }}>
            This action will permanently delete the report. You can always regenerate it later by uploading a new vendor statement.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteReportDialogOpen(false)}
            disabled={deletingReport}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={deletingReport}
            onClick={handleDeleteReport}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: '#f56565',
              borderRadius: '8px',
              '&:hover': { backgroundColor: '#e53e3e' },
            }}
          >
            {deletingReport ? <CircularProgress size={20} color="inherit" /> : 'Delete Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

export default AIBriefPage;
