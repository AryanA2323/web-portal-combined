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
  Menu,
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
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  InsertDriveFile,
  ExpandMore,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import { NotificationBell } from '../../components/case_manager';
import StatCard from './components/StatCard';
import api from '../../services/api';
import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { downloadWordDocument, sanitizeFileName } from '../../utils/reportDownload';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import AlertMessage from '../../components/common/AlertMessage';

const REPORT_STORAGE_KEY = 'aiCaseReviewReports';

const irStatusColors = {
  Open: '#4299e1',
  Approval: '#f6ad55',
  Stop: '#f56565',
  QC: '#9f7aea',
  Dispatch: '#48bb78',
};

const reportStatusColors = {
  'Report Generated': '#48bb78',
  'Report Not Generated': '#ff922b',
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
    // Keep the full absolute URL so images load from the API domain
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

const formatEvidenceTimestamp = (photo) => {
  const rawValue = photo?.captured_at || photo?.uploaded_at || photo?.timestamp;
  if (!rawValue) return '';

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return String(rawValue);

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).replace(',', '');
};

const getEvidenceWatermarkLines = (photo) => {
  const lines = [];
  const locationName = typeof photo?.location_name === 'string' ? photo.location_name.trim() : '';
  const timestamp = formatEvidenceTimestamp(photo);

  if (locationName) {
    lines.push(locationName);
  }
  if (timestamp) {
    lines.push(timestamp);
  }

  return lines;
};

const addImageWatermark = (doc, watermarkLines, x, imageY, width, imageHeight) => {
  if (!watermarkLines?.length) return;

  const paddingX = 4;
  const paddingY = 2.5;
  const lineHeight = 4;
  const wrappedLines = watermarkLines.flatMap((line) => doc.splitTextToSize(line, width - paddingX * 2));
  const boxHeight = paddingY * 2 + wrappedLines.length * lineHeight;
  const boxY = imageY + imageHeight - boxHeight;

  doc.setFillColor(15, 23, 42);
  doc.rect(x, boxY, width, boxHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  wrappedLines.forEach((line, index) => {
    doc.text(line, x + paddingX, boxY + paddingY + 3 + (index * lineHeight));
  });
  doc.setTextColor(30, 30, 30);
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

const extractVendorSubmitStatus = (row) => {
  const subItem = (row.sub_items || []).find((item) => item.assigned_vendor_name);
  return subItem?.check_status || 'Not Initiated';
};

const extractSummary = (row) => {
  const summary = (row.sub_items || []).find((item) => item.statement)?.statement;
  if (summary) return summary;
  if (row.accident_brief) return row.accident_brief;
  if (row.description) return row.description;
  return 'No incident summary available yet.';
};

const AICaseReviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cases, setCases] = useState([]);
  const [totalCases, setTotalCases] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [investigationTypeFilter, setInvestigationTypeFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [reportFilter, setReportFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState([]);
  const [reportsByCase, setReportsByCase] = useState({});
  const [activeReportCaseId, setActiveReportCaseId] = useState(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [viewReportDialogOpen, setViewReportDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [qcs, setQCs] = useState([]);
  const [selectedQC, setSelectedQC] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteReportDialogOpen, setDeleteReportDialogOpen] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);
  const [downloadMenuAnchorEl, setDownloadMenuAnchorEl] = useState(null);


  useEffect(() => {
    fetchVendors();
    fetchQCs();
  }, []);

  useEffect(() => {
    fetchCases(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, statusFilter, investigationTypeFilter, vendorFilter, vendors]);

  const fetchQCs = async (isAutoRefresh = false) => {
    try {
      const response = await api.get('/qcs');
      setQCs(response.data || []);
    } catch (err) {
      console.error('Failed to fetch qcs:', err);
    }
  };

  const fetchVendors = async (isAutoRefresh = false) => {
    try {
      const response = await api.get('/check-vendors');
      setVendors(response.data || []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    }
  };

  const fetchCases = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);
      setError('');
      const [response, reportsResponse] = await Promise.all([
        api.get('/cases/incident-db', {
          params: {
            page: page + 1,
            page_size: rowsPerPage,
            investigation_report_status: statusFilter !== 'all' ? statusFilter : undefined,
            investigation_type: investigationTypeFilter !== 'all' ? investigationTypeFilter : undefined,
            assigned_vendor_name:
              vendorFilter !== 'all'
                ? vendors.find((vendor) => String(vendor.id) === String(vendorFilter))?.company_name || undefined
                : undefined,
          },
        }),
        api.get('/reports').catch(() => ({ data: [] })),
      ]);

      const fetchedCases = response.data.cases || [];
      const backendReports = reportsResponse.data || [];

      setReportsByCase((prev) => {
        const next = { ...prev };
        backendReports.forEach((r) => {
          const matchedCase = fetchedCases.find((c) => c.case_number === r.case_number);
          if (matchedCase) {
            next[matchedCase.id] = {
              ...(next[matchedCase.id] || {}),
              id: r.id,
              caseId: matchedCase.id,
              caseNumber: r.case_number,
              generatedAt: r.created_at,
              reportText: next[matchedCase.id]?.reportText || r.report_content || '',
            };
          }
        });
        return next;
      });

      setCases(fetchedCases);
      setTotalCases(response.data.total || 0);
      setSelected([]);
    } catch (err) {
      console.error('Failed to fetch AI case review cases:', err);
      setError('Failed to load AI case review review data.');
      setCases([]);
      setTotalCases(0);
    } finally {
      setLoading(false);
    }
  };

  useAutoRefresh(fetchCases);
  useAutoRefresh(fetchVendors);
  useAutoRefresh(fetchQCs);

  const rows = useMemo(() => {
    let filteredCases = cases.filter((row) => {
      const checks = row.sub_items || [];
      if (checks.length === 0) return false;
      return checks.every((check) => check.check_status === 'Verified');
    });

    if (reportFilter === 'generated') {
      filteredCases = filteredCases.filter((row) => reportsByCase[row.id]);
    } else if (reportFilter === 'not_generated') {
      filteredCases = filteredCases.filter((row) => !reportsByCase[row.id]);
    }

    return filteredCases.map((row) => {
      const report = reportsByCase[row.id];
      const vendorName = extractAssignedVendor(row);
      const summary = extractSummary(row);

      return {
        ...row,
        summary,
        vendorName,
        vendorAvatar: vendorName?.charAt(0)?.toUpperCase() || 'U',
        reportStatus: report ? 'Report Generated' : 'Report Not Generated',
        reportGeneratedAt: report?.generatedAt || null,
        vendorSubmitStatus: extractVendorSubmitStatus(row),
      };
    });
  }, [cases, reportsByCase, reportFilter]);

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
    setInvestigationTypeFilter('all');
    setVendorFilter('all');
    setReportFilter('all');
    setPage(0);
  };

  const openGenerateDialog = () => {
    if (selected.length !== 1) {
      setError('Select exactly one case to generate a report.');
      return;
    }
    setReportDialogOpen(true);
  };

  const closeGenerateDialog = () => {
    if (generating) return;
    setReportDialogOpen(false);
  };

  const handleGenerateReport = async () => {
    if (!selectedCase) {
      setError('No case selected for report generation.');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      setSuccess('');

      const response = await api.post(`/cases/incident-db/${selectedCase.id}/ai-case-review-report`);

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
        vendorStatements: response.data.vendor_statements || [],
        evidencePhotos: response.data.evidence_photos || [],
        vendorDocuments: response.data.vendor_documents || [],
        caseDocuments: response.data.case_documents || [],
        generatedAt: new Date().toISOString(),
        sourceFileName: 'Stored Vendor Statements',
      };

      setReportsByCase((prev) => ({
        ...prev,
        [selectedCase.id]: reportRecord,
      }));
      setActiveReportCaseId(selectedCase.id);
      setReportDialogOpen(false);
      setViewReportDialogOpen(true);
      setSuccess(`AI case review report generated for case ${response.data.case_number}.`);
    } catch (err) {
      console.error('Failed to generate AI case review report:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to generate AI case review report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenReportView = async (rowId, reportId) => {
    try {
      // Set modal open with whatever we have first so it feels responsive
      setActiveReportCaseId(rowId);
      setViewReportDialogOpen(true);

      // Fetch full report content
      const response = await api.get(`/reports/${reportId}`);
      setReportsByCase((prev) => ({
        ...prev,
        [rowId]: {
          ...prev[rowId],
          reportText: response.data.report_content,
          vendorStatements: response.data.vendor_statements || [],
          evidencePhotos: response.data.evidence_photos || [],
          vendorDocuments: response.data.vendor_documents || [],
          caseDocuments: response.data.case_documents || [],
        },
      }));
    } catch (err) {
      console.error('Failed to fetch full report details:', err);
    }
  };

  const handleDownloadReport = async (format = 'pdf') => {
    if (!activeReport || !activeReportCase) return;

    const caseNum = activeReport.caseNumber || activeReportCase.case_number || 'N/A';
    const metadata = [
      { label: 'Case Number', value: caseNum },
      { label: 'Claim Number', value: activeReportCase.claim_number || 'N/A' },
      { label: 'Business Partner', value: activeReportCase.vendorName || 'Unassigned' },
      { label: 'Generated', value: new Date(activeReport.generatedAt).toLocaleString() },
      { label: 'Statement Source', value: activeReport.sourceFileName || 'Stored Vendor Statements' },
      { label: 'Vendor Statements', value: (activeReport.vendorStatements || []).length },
    ];

    const evidenceItems = [];
    for (const [index, photo] of (activeReport.evidencePhotos || []).entries()) {
      let imageDataUrl = null;
      try {
        imageDataUrl = await getImageDataUrl(photo);
      } catch (err) {
        console.error('Failed to load evidence image for Word export:', err);
      }

      evidenceItems.push({
        title: `Business Partner Evidence ${index + 1}`,
        caption: getEvidenceWatermarkLines(photo).join(' | '),
        imageDataUrl,
      });
    }

    if (format === 'word') {
      downloadWordDocument({
        fileName: `${sanitizeFileName(caseNum, 'ai-case-review-report')}_ai_case_review_report.doc`,
        title: 'AI Case Review Report',
        metadata,
        contentTitle: 'Report Content',
        content: activeReport.reportText || '',
        evidenceItems,
      });
      return;
    }

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
      const imageHeight = 80;
      const watermarkLines = getEvidenceWatermarkLines(photo);

      if (y > doc.internal.pageSize.getHeight() - (imageHeight + 20)) {
        doc.addPage();
        y = 20;
      }

      try {
        const imageDataUrl = await getImageDataUrl(photo);
        if (!imageDataUrl) return;
        const imageFormat = imageDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(imageDataUrl, imageFormat, margin, y, maxWidth, imageHeight);
        addImageWatermark(doc, watermarkLines, margin, y, maxWidth, imageHeight);
        y += imageHeight + 10;

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
    addText('AI Case Review Report', 18, true, [102, 126, 234]);
    y += 4;

    // Meta info
    metadata.forEach((item, index) => {
      addText(`${item.label}: ${item.value}`, 11, index === 0);
    });
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
      addText('BUSINESS PARTNER VISIT PHOTOS', 13, true, [51, 65, 85]);
      y += 6;

      for (const photo of evidencePhotos) {
        await addImage(photo, '');
      }
    }

    const vendorDocs = activeReport.vendorDocuments || [];
    const caseDocs = activeReport.caseDocuments || [];
    const hasAnyDocs = vendorDocs.length > 0 || caseDocs.length > 0;

    if (hasAnyDocs) {
      doc.addPage();
      y = 20;

      if (vendorDocs.length > 0) {
        addText('BUSINESS PARTNER DOCUMENTS', 13, true, [51, 65, 85]);
        y += 6;
        for (let i = 0; i < vendorDocs.length; i++) {
          addText(`Business Partner Document ${i + 1}: ${vendorDocs[i].filename || 'Document'}`, 11, false);
          y += 1;
        }
        y += 8;
      }

      if (caseDocs.length > 0) {
        addText('CASE DOCUMENTS', 13, true, [51, 65, 85]);
        y += 6;
        for (let i = 0; i < caseDocs.length; i++) {
          addText(`Case Document ${i + 1}: ${caseDocs[i].filename || 'Document'}`, 11, false);
          y += 1;
        }
        y += 8;
      }
    }

    const pdfInsertions = [];

    const drawDocumentHeadingAndQueue = async (docObj, labelPrefix) => {
      doc.addPage();
      y = 20;
      addText(`${labelPrefix}: ${docObj.filename || 'Document'}`, 13, true, [51, 65, 85]);
      y += 8;

      const isImage = /\.(jpeg|jpg|png|gif|webp)$/i.test(docObj.url || docObj.filename || '');
      const isPdf = /\.(pdf)$/i.test(docObj.url || docObj.filename || '');

      if (isImage) {
        await addImage({ url: docObj.url }, '');
      } else if (isPdf) {
        pdfInsertions.push({
          afterPageIndex: doc.internal.getNumberOfPages() - 1,
          url: docObj.url,
          filename: docObj.filename
        });
      } else {
        addText(docObj.url || 'No URL available', 9, false, [29, 78, 216]);
      }
    };

    if (vendorDocs.length > 0) {
      for (let i = 0; i < vendorDocs.length; i++) {
        await drawDocumentHeadingAndQueue(vendorDocs[i], `Business Partner Document ${i + 1}`);
      }
    }

    if (caseDocs.length > 0) {
      for (let i = 0; i < caseDocs.length; i++) {
        await drawDocumentHeadingAndQueue(caseDocs[i], `Case Document ${i + 1}`);
      }
    }

    const fileName = `${sanitizeFileName(caseNum, 'ai-case-review-report')}_ai_case_review_report.pdf`;

    if (pdfInsertions.length > 0) {
      try {
        const basePdfBuffer = doc.output('arraybuffer');
        const mergedPdf = await PDFDocument.load(basePdfBuffer);

        pdfInsertions.sort((a, b) => b.afterPageIndex - a.afterPageIndex);

        for (const insertion of pdfInsertions) {
          try {
            const res = await fetch(insertion.url);
            const pdfBytes = await res.arrayBuffer();
            const externalPdf = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(externalPdf, externalPdf.getPageIndices());

            let insertAt = insertion.afterPageIndex + 1;
            for (const page of copiedPages) {
              mergedPdf.insertPage(insertAt, page);
              insertAt++;
            }
          } catch (err) {
            console.error(`Failed to fetch or merge PDF ${insertion.filename}:`, err);
          }
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
      } catch (err) {
        console.error('Failed to merge PDFs:', err);
        doc.save(fileName);
      }
    } else {
      doc.save(fileName);
    }
  };

  const handleEditReport = async () => {
    if (activeReport) {
      // If report doesn't have an ID, first save it to database
      if (!activeReport.id) {
        setSubmitting(true);
        try {
          const saveResponse = await api.post('/reports/', {
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
      await api.put(`/reports/${activeReport.id}/content`, {
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

  const handleAssignQC = async () => {
    if (!activeReport || !selectedQC) {
      setError('Please select a qc to assign.');
      return;
    }

    // If report doesn't have an ID, save it first
    let reportId = activeReport.id;
    if (!reportId) {
      setSubmitting(true);
      try {
        const saveResponse = await api.post('/reports/', {
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
      await api.post(`/reports/${reportId}/assign`, {
        qc_id: selectedQC.id,
      });

      setSelectedQC(null);
      setViewReportDialogOpen(false);
      setSuccess(`Report assigned to ${selectedQC.full_name} successfully.`);
      fetchCases();
    } catch (err) {
      console.error('Failed to assign qc:', err);
      setError(err.response?.data?.detail || 'Failed to assign qc.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete AI case review report handler
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
      setSuccess(`AI case review report for case ${activeReportCase?.case_number || activeReportCaseId} deleted successfully.`);
      fetchCases();
    } catch (err) {
      console.error('Failed to delete report:', err);
      setError(err.response?.data?.detail || 'Failed to delete report.');
    } finally {
      setDeletingReport(false);
    }
  };

  // Regenerate AI case review report handler
  const handleRegenerateReport = async () => {
    if (!activeReportCase) return;

    try {
      setError('');

      // For now, show a message that they need to upload a new statement
      setViewReportDialogOpen(false);
      setSelected([activeReportCase.id]);
      setReportDialogOpen(true);
      setSuccess('Generate a fresh report from the latest stored vendor statements.');
    } catch (err) {
      console.error('Failed to prepare regenerate:', err);
      setError('Failed to prepare report regeneration.');
    }
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  return (
    <CaseManagerLayout disablePadding>
      {/* Top Header Section - AI Case Review Theme */}
      <Box
        sx={{
          minHeight: 110,
          py: 1.75,
          mx: { xs: 1.5, md: 2.5 },
          px: { xs: 2, md: 3 },
          borderRadius: '0 0 16px 16px',
          boxSizing: 'border-box',
          background: 'linear-gradient(120deg, #faf5ff 0%, #f3e8ff 30%, #e0e7ff 65%, #ede9fe 100%)',
          boxShadow: '0 4px 16px rgba(148, 163, 184, 0.08)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderTop: 'none',
        }}
      >
        {/* Multi-Tone Ambient Glowing Mesh Accents */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.18) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.20) 0%, transparent 40%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Left Side: Title & AI Icon */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.15)',
            }}
          >
            <AutoAwesome sx={{ fontSize: 26, color: '#7e22ce' }} />
          </Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.5rem', md: '1.9rem' },
              letterSpacing: '-0.8px',
              background: 'linear-gradient(135deg, #0f172a 0%, #581c87 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            AI Case Review
          </Typography>
        </Box>

        {/* Right Side: 4 Stat Cards in Single Row + Notification Bell */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-end' }}>
          {/* Single Row of 4 Stat Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1.25,
              flex: 1,
              maxWidth: 480,
            }}
          >
            {statsData.map((stat, index) => (
              <Box key={index} sx={{ minWidth: 0 }}>
                <StatCard {...stat} compact={true} hideIcon={true} />
              </Box>
            ))}
          </Box>

          {/* Notification Bell */}
          <Box
            sx={{
              bgcolor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.12)',
              p: 0.5,
              flexShrink: 0,
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.2)',
                transform: 'scale(1.03)',
              },
            }}
          >
            <NotificationBell />
          </Box>
        </Box>
      </Box>

      {/* Main Content Container */}
      <Box sx={{ p: 3, pt: 1 }}>

      {(error || success) && (
        <Box sx={{ mb: 3 }}>
          {error ? (
            <AlertMessage severity="error" onClose={() => setError('')} message={error} open={!!error} />
          ) : null}
          {success ? (
            <AlertMessage severity="success" onClose={() => setSuccess('')} message={success} open={!!success} />
          ) : null}
        </Box>
      )}

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
              AI Case Review Queue
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
                value={investigationTypeFilter}
                onChange={(e) => setInvestigationTypeFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Investigation Types</MenuItem>
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
                <MenuItem value="all">All Business Partners</MenuItem>
                {vendors.map((vendor) => (
                  <MenuItem key={vendor.id} value={String(vendor.id)}>
                    {vendor.company_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' },
                }}
              >
                <MenuItem value="all">All Reports</MenuItem>
                <MenuItem value="generated">Generated</MenuItem>
                <MenuItem value="not_generated">Not Generated</MenuItem>
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
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Case ID</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Summary</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Assigned Business Partner</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Business Partner Status</TableCell>
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
                    <Typography sx={{ color: '#666' }}>No AI case review cases found for the current filters.</Typography>
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
                      hover
                      key={row.id}
                      selected={rowSelected}
                      sx={{
                        '&:last-child td': { border: 0 },
                        cursor: 'pointer',
                        backgroundColor: rowSelected ? '#eff6ff !important' : 'inherit',
                        boxShadow: rowSelected ? 'inset 4px 0 0 0 #2563eb' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => {
                        if (report) {
                          handleOpenReportView(row.id, report.id);
                        } else {
                          setSelected(rowSelected ? [] : [row.id]);
                        }
                      }}
                    >
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
                        <Typography sx={{ fontSize: '14px', color: '#333' }}>
                          {row.vendorSubmitStatus}
                        </Typography>
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
                          endIcon={report ? <ChevronRight sx={{ fontSize: 16 }} /> : (rowSelected ? <CheckCircle sx={{ fontSize: 16 }} /> : <ChevronRight sx={{ fontSize: 16 }} />)}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (report) {
                              handleOpenReportView(row.id, report.id);
                            } else {
                              setSelected(rowSelected ? [] : [row.id]);
                            }
                          }}
                          sx={{
                            backgroundColor: report ? '#667eea' : (rowSelected ? '#16a34a' : '#667eea'),
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '13px',
                            borderRadius: '6px',
                            minWidth: '104px',
                            '&:hover': { backgroundColor: report ? '#5568d3' : (rowSelected ? '#15803d' : '#5568d3') },
                          }}
                        >
                          {report ? 'View Report' : (rowSelected ? 'Selected' : 'Select Case')}
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
            {rows.length === 0 ? '0 results' : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, rows.length)} of ${rows.length}`}
          </Typography>
          <TablePagination
            component="div"
            count={rows.length}
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
        <DialogTitle sx={{ fontWeight: 700 }}>Generate AI Case Review Report</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: '14px', color: '#475569', mb: 2 }}>
            {selectedCase
              ? `Generate AI case review for case ${selectedCase.case_number || selectedCase.id} using statements already stored by the business partner across checks.`
              : 'Select a case first.'}
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#64748b' }}>
            The report will include all available statements and evidence already saved in the database.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeGenerateDialog} disabled={generating} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateReport}
            disabled={generating}
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
          setSelectedQC(null);
          setDownloadMenuAnchorEl(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            AI Case Review Report
            {activeReportCase && (
              <Typography sx={{ fontSize: '14px', color: '#666', fontWeight: 400 }}>
                Case: {activeReportCase.case_number || activeReportCase.id}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={(event) => setDownloadMenuAnchorEl(event.currentTarget)}
            disabled={!activeReport || editMode}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
            }}
          >
            Download
          </Button>
          <Menu
            anchorEl={downloadMenuAnchorEl}
            open={Boolean(downloadMenuAnchorEl)}
            onClose={() => setDownloadMenuAnchorEl(null)}
          >
            <MenuItem
              onClick={() => {
                setDownloadMenuAnchorEl(null);
                handleDownloadReport('pdf');
              }}
            >
              Download as PDF
            </MenuItem>
            <MenuItem
              onClick={() => {
                setDownloadMenuAnchorEl(null);
                handleDownloadReport('word');
              }}
            >
              Download as Word
            </MenuItem>
          </Menu>
        </DialogTitle>
        <DialogContent dividers>
          {activeReport && activeReportCase ? (
            <Box>
              <Typography sx={{ fontSize: '13px', color: '#64748b', mb: 2 }}>
                Source: {activeReport.sourceFileName || 'Stored Statements'} | Generated {formatRelativeDate(activeReport.generatedAt)}
              </Typography>

              {activeReport.vendorStatements && activeReport.vendorStatements.length > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    borderRadius: '10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    p: 2,
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 1 }}>
                    Statements ({activeReport.vendorStatements.length})
                  </Typography>
                  {activeReport.vendorStatements.map((item, index) => (
                    <Box
                      key={`statement-${index}`}
                      sx={{
                        p: 1.25,
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#fff',
                        mb: index === activeReport.vendorStatements.length - 1 ? 0 : 1,
                      }}
                    >
                      <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#334155', mb: 0.5 }}>
                        {item.check_type || 'Check'} | Statement {item.statement_index || index + 1}
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                        {item.statement_text || ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

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
                    Business Partner Evidence
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
                      const watermarkLines = getEvidenceWatermarkLines(photo);

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
                          <Box sx={{ position: 'relative', backgroundColor: '#0f172a' }}>
                            <img
                              src={resolveEvidencePhotoUrl(photoUrl)}
                              alt={`Business Partner Evidence ${idx + 1}`}
                              style={{
                                display: 'block',
                                width: '100%',
                                height: '250px',
                                objectFit: 'cover',
                              }}
                            />
                            {watermarkLines.length > 0 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  px: 1.5,
                                  py: 1,
                                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.86) 48%, rgba(15, 23, 42, 0.96) 100%)',
                                }}
                              >
                                {watermarkLines.map((line, lineIndex) => (
                                  <Typography
                                    key={`${idx}-${lineIndex}`}
                                    sx={{
                                      fontSize: '12px',
                                      lineHeight: 1.35,
                                      color: '#ffffff',
                                      fontWeight: 600,
                                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {line}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {!editMode && activeReport.vendorDocuments && activeReport.vendorDocuments.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Business Partner Documents
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {activeReport.vendorDocuments.map((doc, idx) => (
                      <Button
                        key={`vendor-doc-${idx}`}
                        variant="outlined"
                        component="a"
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<InsertDriveFile fontSize="small" />}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none', borderRadius: '6px', maxWidth: '400px' }}
                      >
                        {doc.filename || `Business Partner Document ${idx + 1}`}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}

              {!editMode && activeReport.caseDocuments && activeReport.caseDocuments.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Case Documents (Policy, Petition, etc.)
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {activeReport.caseDocuments.map((doc, idx) => (
                      <Button
                        key={`case-doc-${idx}`}
                        variant="outlined"
                        component="a"
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<InsertDriveFile fontSize="small" />}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none', borderRadius: '6px', maxWidth: '400px' }}
                      >
                        {doc.filename || `Case Document ${idx + 1}`}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}

              {!editMode && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 2 }}>
                    Assign to QC for Review
                  </Typography>
                  <FormControl fullWidth>
                    <Select
                      value={selectedQC?.id || ''}
                      onChange={(e) => {
                        const qc = qcs.find((l) => l.id === e.target.value);
                        setSelectedQC(qc);
                      }}
                      displayEmpty
                      sx={{ mb: 2 }}
                    >
                      <MenuItem value="">Select a qc</MenuItem>
                      {qcs.map((qc) => (
                        <MenuItem key={qc.id} value={qc.id}>
                          {qc.full_name} ({qc.email})
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
              setSelectedQC(null);
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
                onClick={handleAssignQC}
                disabled={submitting || !selectedQC}
                sx={{
                  backgroundColor: '#667eea',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#5568d3' },
                }}
              >
                {submitting ? <CircularProgress size={20} color="inherit" /> : 'Assign to QC'}
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
          Delete AI Case Review Report
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '14px', color: '#666', mb: 2 }}>
            Are you sure you want to delete the AI case review report for case <strong>{activeReportCase?.case_number}</strong>?
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#999' }}>
            This action will permanently delete the report. You can always regenerate it later from stored vendor statements.
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
    </Box>
  </CaseManagerLayout>
  );
};

export default AICaseReviewPage;



