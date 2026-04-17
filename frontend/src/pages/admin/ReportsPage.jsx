import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
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
import { CheckCircle, FileDownload, Refresh, Search } from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import api from '../../services/api';
import jsPDF from 'jspdf';
import { downloadWordDocument, sanitizeFileName } from '../../utils/reportDownload';

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

const getEvidenceImageDataUrl = async (photo) => {
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

const formatEvidenceLocationForWatermark = (photo) => {
  const locationName = typeof photo?.location_name === 'string' ? photo.location_name.trim() : '';
  const pincodeMatch = locationName.match(/\b\d{6}\b/);
  const pincode = pincodeMatch ? pincodeMatch[0] : '';
  const parts = locationName.split(',').map((part) => part.trim()).filter(Boolean);
  let city = '';

  if (pincode) {
    const pincodeIndex = parts.findIndex((part) => part.includes(pincode));
    if (pincodeIndex > 0) {
      city = parts[pincodeIndex - 1].replace(/\b\d{6}\b/g, '').trim();
    }
  }

  if (!city) {
    city = parts.find((part) => /[A-Za-z]/.test(part) && !/\b\d{6}\b/.test(part) && !/^india$/i.test(part)) || '';
  }

  if (city && pincode) return `${city}, ${pincode}`;
  if (city) return city;
  if (pincode) return pincode;
  return '';
};

const getEvidenceWatermarkLines = (photo) => {
  const lines = [];
  const locationLine = formatEvidenceLocationForWatermark(photo);
  const timestamp = formatEvidenceTimestamp(photo);

  if (locationLine) lines.push(locationLine);
  if (timestamp) lines.push(timestamp);
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

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [downloadingReportId, setDownloadingReportId] = useState(null);
  const [downloadMenuAnchorEl, setDownloadMenuAnchorEl] = useState(null);
  const [selectedDownloadRow, setSelectedDownloadRow] = useState(null);

  const fetchApprovedReports = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/reports', {
        params: { status: 'ACCEPTED' },
      });
      setReports(response.data || []);
    } catch (err) {
      console.error('Failed to fetch approved reports:', err);
      setError('Failed to load approved reports.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedReports();
  }, []);

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return reports;

    return reports.filter((report) => (
      String(report.case_number || '').toLowerCase().includes(query)
      || String(report.claim_number || '').toLowerCase().includes(query)
      || String(report.client_name || '').toLowerCase().includes(query)
      || String(report.case_title || '').toLowerCase().includes(query)
      || String(report.assigned_lawyer_name || '').toLowerCase().includes(query)
    ));
  }, [reports, searchTerm]);

  const paginatedReports = filteredReports.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openDownloadMenu = (event, row) => {
    setDownloadMenuAnchorEl(event.currentTarget);
    setSelectedDownloadRow(row);
  };

  const closeDownloadMenu = () => {
    setDownloadMenuAnchorEl(null);
    setSelectedDownloadRow(null);
  };

  const handleDownloadReport = async (row, format = 'pdf') => {
    if (!row?.id) return;

    try {
      setDownloadingReportId(row.id);
      setError('');

      const response = await api.get(`/reports/${row.id}`);
      const reportContent = String(response?.data?.report_content || '').trim();

      if (!reportContent) {
        setError('Report content is empty and cannot be downloaded.');
        return;
      }

      const caseFilePart = sanitizeFileName(row.case_number, `report-${row.id}`);
      const metadata = [
        { label: 'Case Number', value: response?.data?.case_number || row.case_number || '-' },
        { label: 'Claim Number', value: response?.data?.claim_number || row.claim_number || '-' },
        { label: 'Client Name', value: response?.data?.client_name || row.client_name || '-' },
        { label: 'Category', value: response?.data?.category || row.category || '-' },
        { label: 'Assigned Lawyer', value: response?.data?.assigned_lawyer_name || row.assigned_lawyer_name || '-' },
        { label: 'Reviewed On', value: formatDate(response?.data?.reviewed_at || row.reviewed_at || row.created_at) },
      ];

      const evidencePhotos = Array.isArray(response?.data?.evidence_photos) ? response.data.evidence_photos : [];
      const evidenceItems = [];

      for (const [index, photo] of evidencePhotos.entries()) {
        let imageDataUrl = null;
        try {
          imageDataUrl = await getEvidenceImageDataUrl(photo);
        } catch (imageError) {
          console.error('Failed to load evidence image for download:', imageError);
        }

        evidenceItems.push({
          title: `Vendor Evidence ${index + 1}`,
          caption: getEvidenceWatermarkLines(photo).join(' | '),
          imageDataUrl,
        });
      }

      if (format === 'word') {
        downloadWordDocument({
          fileName: `${caseFilePart}-approved-report.doc`,
          title: 'Approved Report',
          metadata,
          contentTitle: 'Report Content',
          content: reportContent,
          evidenceItems,
        });
        return;
      }

      const doc = new jsPDF();
      const margin = 16;
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const textWidth = pageWidth - (margin * 2);
      let y = 20;

      const addLine = (text, fontSize = 11, isBold = false) => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(String(text), textWidth);

        lines.forEach((line) => {
          if (y > pageHeight - 14) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin, y);
          y += fontSize * 0.55;
        });
      };

      addLine('Approved Report', 16, true);
      y += 2;
      metadata.forEach((item) => addLine(`${item.label}: ${item.value}`));

      y += 3;
      addLine('Report Content', 13, true);
      y += 1;
      addLine(reportContent, 11, false);

      if (evidenceItems.length > 0) {
        y += 8;
        addLine('Vendor Evidence', 13, true);
        y += 2;

        for (const evidenceItem of evidenceItems) {
          try {
            const imageDataUrl = evidenceItem.imageDataUrl;
            if (!imageDataUrl) continue;

            const imageFormat = imageDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            const imageHeight = 78;

            if (y > pageHeight - imageHeight - 16) {
              doc.addPage();
              y = 20;
            }

            const watermarkLines = evidenceItem.caption ? evidenceItem.caption.split(' | ') : [];
            doc.addImage(imageDataUrl, imageFormat, margin, y, textWidth, imageHeight);
            addImageWatermark(doc, watermarkLines, margin, y, textWidth, imageHeight);
            y += imageHeight + 8;
          } catch (imageError) {
            console.error('Failed to add evidence image to PDF:', imageError);
          }
        }
      }

      doc.save(`${caseFilePart}-approved-report.pdf`);
    } catch (err) {
      console.error('Failed to download approved report:', err);
      setError('Failed to download approved report. Please try again.');
    } finally {
      setDownloadingReportId(null);
    }
  };

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#333' }}>
          Reports
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

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
              Lawyer Approved Reports
            </Typography>

            <TextField
              placeholder="Search case/client/lawyer..."
              size="small"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#999', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                ml: 'auto',
                width: '260px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  backgroundColor: '#f5f5f5',
                  '& fieldset': { border: 'none' },
                },
              }}
            />

            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={fetchApprovedReports}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Case Number</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Claim Number</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Client Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Assigned Lawyer</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Approved On</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#666' }}>Download</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size={26} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : paginatedReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 4, textAlign: 'center', color: '#666' }}>
                    No approved reports found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReports.map((row) => (
                  <TableRow hover key={row.id} sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                    <TableCell sx={{ fontWeight: 600, color: '#1976d2' }}>{row.case_number || '-'}</TableCell>
                    <TableCell>{row.claim_number || '-'}</TableCell>
                    <TableCell>{row.client_name || '-'}</TableCell>
                    <TableCell>{row.category || '-'}</TableCell>
                    <TableCell>{row.assigned_lawyer_name || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                        label="Approved"
                        sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>{formatDate(row.reviewed_at || row.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FileDownload />}
                        onClick={(event) => openDownloadMenu(event, row)}
                        disabled={downloadingReportId === row.id}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                      >
                        {downloadingReportId === row.id ? 'Downloading...' : 'Download'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredReports.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{ borderTop: '1px solid #e0e0e0' }}
        />

        <Menu
          anchorEl={downloadMenuAnchorEl}
          open={Boolean(downloadMenuAnchorEl)}
          onClose={closeDownloadMenu}
        >
          <MenuItem
            onClick={() => {
              const row = selectedDownloadRow;
              closeDownloadMenu();
              if (row) handleDownloadReport(row, 'pdf');
            }}
          >
            Download as PDF
          </MenuItem>
          <MenuItem
            onClick={() => {
              const row = selectedDownloadRow;
              closeDownloadMenu();
              if (row) handleDownloadReport(row, 'word');
            }}
          >
            Download as Word
          </MenuItem>
        </Menu>
      </Paper>
    </AdminLayout>
  );
};

export default ReportsPage;
