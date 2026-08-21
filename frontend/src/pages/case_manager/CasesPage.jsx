import React, { useState, useEffect } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Stack,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Search,
  Add,
  FolderOpen,
  Folder,
  Schedule,
  CheckCircle,
  Warning,
  ExpandMore,
  ChevronRight,
  Delete,
  Edit,
  Close,
  Visibility,
  Description,
  Assignment,
  Collections,
  InsertDriveFile,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import StatCard from './components/StatCard';
import CreateCaseDialog from './components/CreateCaseDialog';
import api from '../../services/api';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { NotificationBell } from '../../components/case_manager';

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = api.defaults.baseURL || 'http://localhost:8000/api';
  const cleanBase = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
  return `${cleanBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Full case status colors (incident_case_db values)
const fullCaseStatusColors = {
  'WIP': '#f6ad55',
  'Pending CS': '#ed8936',
  'Closed': '#48bb78',
  'IR-Writing': '#4299e1',
  'NI': '#a0aec0',
  'Withdraw': '#f56565',
  'QC-1': '#9f7aea',
  'Pending Additional Docs': '#ed8936',
  'Connected Pending': '#b794f4',
  'RCU Pending': '#76e4f7',
  'Portal Upload': '#667eea',
};

// Investigation report status colors
const irStatusColors = {
  'Open': '#4299e1',
  'Approval': '#f6ad55',
  'Stop': '#f56565',
  'QC': '#9f7aea',
  'Dispatch': '#48bb78',
};

// Verification check_status colors
const checkStatusColors = {
  'Not Initiated': '#a0aec0',
  'WIP': '#f6ad55',
  'Closed': '#48bb78',
  'Stop': '#f56565',
};

// Investigation type chip colors
const investigationTypeColors = {
  'Full Case': '#667eea',
  'Partial Case': '#9f7aea',
  'Reassessment': '#4299e1',
  'Connected Case': '#76e4f7',
};

const QUESTIONNAIRE_LABELS = {
  relation: 'Relation with Deceased / Injured',
  claim_type: 'Type of Claim',
  deceased_injury_name: 'Deceased / Injured Person Name',
  deceased_injury_income: 'Deceased / Injured Income',
  monthly_income: 'Monthly Income of Claimant',
  hr_manager: 'Name & No. of Company HR / Manager',
  fir_date: 'FIR Date',
  reason_if_delayed: 'Reason if Delayed',
  date_of_accident: 'Date of Accident',
  time_of_accident: 'Time of Accident',
  description_of_accident: 'Description of Accident',
  investigation_datetime: 'Date & Time of Investigation',
  insured_name: 'Insured Name',
  insured_address: 'Insured Address',
  insured_contact: 'Contact Number',
  vehicle_number: 'Vehicle Number',
  vehicle_type: 'Vehicle Type',
  rc: 'RC Number',
  rc_expiry: 'RC Expiry Date',
  driver_name: 'Driver Name',
  driver_contact: 'Driver Contact',
  dl: 'DL Number',
  dl_expiry: 'DL Expiry Date',
  insurance_holder_name: 'Insurance Holder Name',
  policy_expiry_date: 'Policy Expiry Date',
  different_owner_reason: 'Reason if Owner Different',
  driver_address: 'Driver Address',
  driver_relation: 'Relation with Insured',
};

const KNOWN_Q_KEYS = new Set(Object.keys({
  relation: 1, claim_type: 1, deceased_injury_name: 1, deceased_injury_income: 1,
  monthly_income: 1, hr_manager: 1, fir_date: 1, reason_if_delayed: 1, date_of_accident: 1, time_of_accident: 1,
  description_of_accident: 1, investigation_datetime: 1,
  insured_name: 1, insured_address: 1, insured_contact: 1, vehicle_number: 1, vehicle_type: 1, rc: 1, rc_expiry: 1,
  driver_name: 1, driver_contact: 1, dl: 1, dl_expiry: 1, insurance_holder_name: 1, policy_expiry_date: 1, different_owner_reason: 1,
  driver_address: 1, driver_relation: 1,
}));

const parseQuestionnaire = (rawVal) => {
  if (!rawVal) return null;
  let parsed = rawVal;
  // Handle string (possibly double-serialized)
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    } catch (e) {
      return null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  // Check if the object already has known questionnaire field names
  const knownEntries = {};
  let foundKnown = 0;
  for (const k of Object.keys(parsed)) {
    if (KNOWN_Q_KEYS.has(k)) {
      knownEntries[k] = parsed[k];
      foundKnown++;
    }
  }
  if (foundKnown > 0) return knownEntries;

  // Fallback: if it's a character-indexed object ({"0": "{", "1": "\"", ...})
  if (parsed['0'] !== undefined && parsed['1'] !== undefined) {
    try {
      const numericKeys = Object.keys(parsed).filter(k => /^\d+$/.test(k));
      numericKeys.sort((a, b) => Number(a) - Number(b));
      const str = numericKeys.map(k => parsed[k]).join('');
      let inner = JSON.parse(str);
      if (typeof inner === 'string') inner = JSON.parse(inner);
      if (typeof inner === 'object' && inner !== null && !Array.isArray(inner)) return inner;
    } catch (e) {
      return null;
    }
  }

  // If it has any keys at all, return it as-is (generic questionnaire data)
  if (Object.keys(parsed).length > 0) return parsed;
  return null;
};

const CasesPage = ({ isClosedView = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fullCaseStatusFilter, setFullCaseStatusFilter] = useState(isClosedView ? 'Closed' : 'all');
  const [investigationTypeFilter, setInvestigationTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCases, setTotalCases] = useState(0);
  const [selected, setSelected] = useState([]);
  const [expandedCases, setExpandedCases] = useState({});

  // Full case view modal state
  const [fullCaseModalOpen, setFullCaseModalOpen] = useState(false);
  const [fullCaseLoading, setFullCaseLoading] = useState(false);
  const [fullCaseData, setFullCaseData] = useState(null);
  const [fullCaseTab, setFullCaseTab] = useState(0);
  const [selectedCheckTab, setSelectedCheckTab] = useState(0);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusConfirmAction, setStatusConfirmAction] = useState(null);
  // Vendor assignment modal state
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorList, setVendorList] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorAssigning, setVendorAssigning] = useState(false);
  const [vendorModalTarget, setVendorModalTarget] = useState(null); // { caseId, checkType, vendorName }

  // Delete case modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [activePhotoPreview, setActivePhotoPreview] = useState(null);

  // Review action states
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewVendorId, setReviewVendorId] = useState('');
  const [confirmAcceptOpen, setConfirmAcceptOpen] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // RTI Modal State
  const [rtiModalOpen, setRtiModalOpen] = useState(false);


  const handleExportDrop = (e, to) => {
    e.preventDefault();
    const fieldId = e.dataTransfer.getData('fieldId');
    const from = e.dataTransfer.getData('from');
    if (from === to) return;

    if (to === 'selected') {
      const field = availableExportFields.find(f => f.id === fieldId);
      if (field) {
        setAvailableExportFields(prev => prev.filter(f => f.id !== fieldId));
        setSelectedExportFields(prev => [...prev, field]);
      }
    } else {
      const field = selectedExportFields.find(f => f.id === fieldId);
      if (field) {
        setSelectedExportFields(prev => prev.filter(f => f.id !== fieldId));
        setAvailableExportFields(prev => [...prev, field]);
      }
    }
  };

  const handleExportDragOver = (e) => {
    e.preventDefault(); // allow drop
  };

  const handleExportCases = async (exportAll = false) => {
    try {
      setExporting(true);
      const fieldsToExport = exportAll ? ALL_EXPORT_FIELDS.map(f => f.id) : selectedExportFields.map(f => f.id);

      if (!exportAll && fieldsToExport.length === 0) {
        setSnackbar({ open: true, message: 'Please select at least one field to export.', severity: 'warning' });
        setExporting(false);
        return;
      }

      const payload = {
        fields: fieldsToExport,
        search: searchTerm,
        full_case_status: fullCaseStatusFilter !== 'all' ? fullCaseStatusFilter : null,
        investigation_type: investigationTypeFilter !== 'all' ? investigationTypeFilter : null,
        investigation_report_status: null, // Can map if needed
        assigned_vendor_name: null // Can map if needed
      };

      const response = await api.post('/cases/incident-db/export', payload, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'cases_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();

      setExportModalOpen(false);
      setSnackbar({ open: true, message: 'Export successful!', severity: 'success' });
    } catch (err) {
      console.error('Export failed:', err);
      setSnackbar({ open: true, message: 'Failed to export cases.', severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const [rtiFormData, setRtiFormData] = useState({ toAddress: '', accidentDate: null, accidentTime: null });
  const [rtiTarget, setRtiTarget] = useState(null); // { caseId, chargesheetId }
  const [rtiGenerating, setRtiGenerating] = useState(false);

  const [section134ModalOpen, setSection134ModalOpen] = useState(false);
  const [section134FormData, setSection134FormData] = useState({ toAddress: '' });
  const [section134Target, setSection134Target] = useState(null); // { caseId }
  const [section134Generating, setSection134Generating] = useState(false);
  const [section134History, setSection134History] = useState([]);
  const [section134HistoryLoading, setSection134HistoryLoading] = useState(false);
  const [section134HistoryUpdating, setSection134HistoryUpdating] = useState(false);

  // RTO Doc Modal state
  const [rtoDocModalOpen, setRtoDocModalOpen] = useState(false);
  const [rtoDocLoading, setRtoDocLoading] = useState(false);
  const [rtoDocGenerating, setRtoDocGenerating] = useState(false);
  const [rtoDocData, setRtoDocData] = useState(null);
  const [rtoDocTargetCaseId, setRtoDocTargetCaseId] = useState(null);
  const [selectedRtoDocType, setSelectedRtoDocType] = useState('DL Extract');
  const [rtoDocForm, setRtoDocForm] = useState({
    to: '',
    subjectName: '',
    idNumber: '',
    authorizedSignatory: '',
    contactNumber: '',
    emailId: '',
  });

  const handleOpenRtoDocModal = async (caseId) => {
    try {
      setRtoDocTargetCaseId(caseId);
      setRtoDocLoading(true);
      setRtoDocModalOpen(true);
      setSelectedRtoDocType('DL Extract');

      const storedUserRaw = sessionStorage.getItem('user') || localStorage.getItem('user');
      let cmName = '';
      if (storedUserRaw) {
        try {
          const u = JSON.parse(storedUserRaw);
          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
          cmName = fullName || u.name || u.email || '';
        } catch (e) { }
      }

      const res = await api.get(`/cases/incident-db/${caseId}/check/rto`);
      setRtoDocData(res.data);
      const c = res.data?.case || {};

      const activeCmName = cmName || c.case_manager_name || c.created_by_name || 'Amit Dalvi';

      setRtoDocForm({
        to: '',
        subjectName: '',
        idNumber: '',
        authorizedSignatory: activeCmName,
        contactNumber: '',
        emailId: '',
      });
    } catch (err) {
      console.error('Failed to load RTO details:', err);
      setRtoDocData(null);
      setRtoDocForm({
        to: '',
        subjectName: '',
        idNumber: '',
        authorizedSignatory: 'Amit Dalvi',
        contactNumber: '',
        emailId: '',
      });
    } finally {
      setRtoDocLoading(false);
    }
  };

  const handleGenerateRtoDoc = async () => {
    if (!rtoDocTargetCaseId) return;
    try {
      setRtoDocGenerating(true);
      const response = await api.post(`/cases/incident-db/${rtoDocTargetCaseId}/generate-rto-rti`, {
        doc_type: selectedRtoDocType,
        to_address: rtoDocForm.to,
        subject_name: rtoDocForm.subjectName,
        id_number: rtoDocForm.idNumber,
        authorized_signatory: rtoDocForm.authorizedSignatory,
        contact_number: rtoDocForm.contactNumber,
        email_id: rtoDocForm.emailId,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = selectedRtoDocType === 'All' ? 'RTO_RTI_Applications.zip' : `${selectedRtoDocType.replace(/\s+/g, '_')}_RTI.docx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) filename = filenameMatch[1];
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'Document generated and downloaded successfully!', severity: 'success' });

      // Refetch the RTO doc data so the preview updates immediately
      try {
        const refetchRes = await api.get(`/cases/incident-db/${rtoDocTargetCaseId}/check/rto`);
        setRtoDocData(refetchRes.data);
      } catch (err) {
        console.error('Failed to refetch RTO document details after generation:', err);
      }
    } catch (err) {
      console.error('Failed to generate RTO document:', err);
      setSnackbar({ open: true, message: 'Failed to generate RTO document', severity: 'error' });
    } finally {
      setRtoDocGenerating(false);
    }
  };

  const handleOpenFileRti = (caseId, chargesheetId) => {
    setRtiTarget({ caseId, chargesheetId });
    setRtiFormData({ toAddress: '', accidentDate: null, accidentTime: null });
    setRtiModalOpen(true);
  };

  const handleGenerateRti = async () => {
    if (!rtiFormData.toAddress || !rtiFormData.accidentDate || !rtiFormData.accidentTime) {
      setSnackbar({ open: true, message: 'Please fill all fields', severity: 'error' });
      return;
    }
    setRtiGenerating(true);
    try {
      const d = rtiFormData.accidentDate.toDate();
      const t = rtiFormData.accidentTime.toDate();
      const dd = String(d.getDate()).padStart(2, '0');
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const y = d.getFullYear();

      const hours = t.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hr12 = String(hours % 12 || 12).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');

      const formattedDate = `${dd}/${m}/${y} at about ${hr12}:${mm} ${ampm}`;
      const response = await api.post(`/cases/${rtiTarget.caseId}/chargesheet/${rtiTarget.chargesheetId}/generate-rti`, {
        to_address: rtiFormData.toAddress,
        date_of_accident: formattedDate
      }, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'RTI_Application.docx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setRtiModalOpen(false);
      setSnackbar({ open: true, message: 'RTI generated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error generating RTI:', error);
      setSnackbar({ open: true, message: 'Failed to generate RTI', severity: 'error' });
    } finally {
      setRtiGenerating(false);
    }
  };

  const handleOpenSection134 = async (caseId) => {
    setSection134Target({ caseId });
    setSection134FormData({ toAddress: '' });
    setSection134ModalOpen(true);
    setSection134HistoryLoading(true);
    try {
      const response = await api.get(`/cases/${caseId}/section134-history`);
      setSection134History(response.data.history || []);
    } catch (error) {
      console.error('Error fetching Section 134 history:', error);
      setSection134History([]);
    } finally {
      setSection134HistoryLoading(false);
    }
  };

  const handleUpdateSection134History = async () => {
    if (!section134Target) return;
    setSection134HistoryUpdating(true);
    try {
      const response = await api.post(`/cases/${section134Target.caseId}/section134-history`);
      setSection134History(response.data.history || []);
      setSnackbar({ open: true, message: 'Notice count updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error updating Section 134 history:', error);
      setSnackbar({ open: true, message: 'Failed to update notice count', severity: 'error' });
    } finally {
      setSection134HistoryUpdating(false);
    }
  };

  const handleGenerateSection134 = async () => {
    if (!section134FormData.toAddress) {
      setSnackbar({ open: true, message: 'Please provide the "To" address', severity: 'error' });
      return;
    }
    setSection134Generating(true);
    try {
      const response = await api.post(`/cases/${section134Target.caseId}/generate-section134`, {
        to_address: section134FormData.toAddress
      }, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'Section134_Notice.docx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSection134ModalOpen(false);
      setSnackbar({ open: true, message: 'Section 134 Notice generated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error generating Section 134 Notice:', error);
      setSnackbar({ open: true, message: 'Failed to generate Section 134 Notice', severity: 'error' });
    } finally {
      setSection134Generating(false);
    }
  };



  // Fetch data on mount
  useEffect(() => {
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, fullCaseStatusFilter, investigationTypeFilter]);

  const fetchData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) setLoading(true);

      const [statsRes, casesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/cases/incident-db', {
          params: {
            page: page + 1,
            page_size: rowsPerPage,
            full_case_status: fullCaseStatusFilter !== 'all' ? fullCaseStatusFilter : undefined,
            investigation_type: investigationTypeFilter !== 'all' ? investigationTypeFilter : undefined,
            search: searchTerm || undefined,
          },
        }),
      ]);

      setStats(statsRes.data);
      setCases(casesRes.data.cases || []);
      setTotalCases(casesRes.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useAutoRefresh(fetchData);

  // Search handler with debounce
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
  };

  // Trigger search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchData();
    }
  };

  // Build stats data from API response
  const statsData = stats ? [
    {
      title: 'Total Cases',
      value: stats.total_cases || 0,
      change: stats.total_change || 0,
      icon: FolderOpen,
      iconBgColor: '#e3f2fd',
    },
    {
      title: 'WIP Cases',
      value: stats.active_investigations || 0,
      change: stats.active_change || 0,
      icon: Schedule,
      iconBgColor: '#fff3e0',
    },
    {
      title: 'Closed Cases',
      value: stats.closed_cases || 0,
      change: stats.closed_change || 0,
      icon: CheckCircle,
      iconBgColor: '#e8f5e9',
      onClick: () => navigate('/case_manager/closed-cases'),
    },
    {
      title: 'Overdue Cases',
      value: stats.overdue_cases || 0,
      change: stats.overdue_change || 0,
      icon: Warning,
      iconBgColor: '#ffebee',
    },
  ] : [];

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = cases.map((n) => n.id);
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

  const isSelected = (id) => selected.indexOf(id) !== -1;

  const handleToggleCaseStatus = async (caseId, newStatus) => {
    try {
      setStatusLoading(true);
      await api.patch(`/cases/incident-db/${caseId}/status`, { status: newStatus });
      setSnackbar({ open: true, message: `Case status updated to ${newStatus}`, severity: 'success' });
      // Update local state for immediate feedback
      if (fullCaseData && fullCaseData.case.id === caseId) {
        setFullCaseData(prev => ({
          ...prev,
          case: { ...prev.case, full_case_status: newStatus }
        }));
      }
      setCases(prevCases =>
        prevCases.map(c => c.id === caseId ? { ...c, full_case_status: newStatus } : c)
      );
    } catch (error) {
      console.error('Error updating case status:', error);
      setSnackbar({ open: true, message: error.response?.data?.error || 'Failed to update case status', severity: 'error' });
    } finally {
      setStatusLoading(false);
    }
  };

  // Create case handler
  const handleCreateCase = () => {
    navigate('/case_manager/cases/new');
  };

  // Toggle case expansion
  const toggleCaseExpansion = (caseId) => {
    setExpandedCases(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  // Sub-items come directly from API (incident_case_db verification tables)
  const getSubCases = (caseData) => caseData.sub_items || [];

  const typeToSlug = {
    'Claimant Check': 'claimant',
    'Insured Check': 'insured',
    'Driver Check': 'driver',
    'Spot Check': 'spot',
    'Chargesheet': 'chargesheet',
    'RTI Check': 'rti',
    'RTO Check': 'rto',
  };

  // Open Full Case View Modal
  const openFullCaseModal = async (caseId) => {
    try {
      setFullCaseLoading(true);
      setFullCaseModalOpen(true);
      setFullCaseTab(0);
      setSelectedCheckTab(0);
      const res = await api.get(`/cases/incident-db/${caseId}/full-details`);
      setFullCaseData(res.data);
    } catch (err) {
      console.error('Failed to fetch full case details:', err);
      setSnackbar({ open: true, message: 'Failed to load case details', severity: 'error' });
      setFullCaseModalOpen(false);
    } finally {
      setFullCaseLoading(false);
    }
  };

  // Open vendor assignment modal for a sub-check
  const openVendorModal = async (caseId, checkType, currentVendorId = '') => {
    setVendorModalTarget({ caseId, checkType });
    setSelectedVendorId(currentVendorId ? String(currentVendorId) : '');
    setVendorModalOpen(true);
    try {
      const res = await api.get(`/check-vendors?check_type=${checkType.toLowerCase()}`);
      setVendorList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
      setVendorList([]);
    }
  };

  // Assign vendor to sub-check
  const handleAssignVendorToCheck = async () => {
    if (!vendorModalTarget) return;
    const { caseId, checkType } = vendorModalTarget;
    const slug = typeToSlug[checkType] || checkType.toLowerCase();
    try {
      setVendorAssigning(true);
      await api.patch(`/cases/incident-db/${caseId}/check/${slug}/reassign`, {
        vendor_id: selectedVendorId ? parseInt(selectedVendorId, 10) : null,
      });
      setVendorModalOpen(false);
      setVendorModalTarget(null);
      setSelectedVendorId('');
      await fetchData();
    } catch (err) {
      console.error('Failed to update vendor:', err);
      alert('Failed to update vendor. Please try again.');
    } finally {
      setVendorAssigning(false);
    }
  };

  // Open Review modal for a sub-check
  const openReviewModal = async (caseId, checkTypeLabel) => {
    const slug = typeToSlug[checkTypeLabel] || checkTypeLabel.toLowerCase();
    try {
      setReviewLoading(true);
      setReviewModalOpen(true);
      setReviewAction(null);
      setReviewFeedback('');
      setReviewVendorId('');

      const res = await api.get(`/cases/incident-db/${caseId}/check/${slug}`);
      setReviewData(res.data);

      const vRes = await api.get('/check-vendors');
      setVendorList(vRes.data || []);
    } catch (err) {
      console.error('Failed to fetch check detail for review:', err);
      alert('Failed to load check details');
      setReviewModalOpen(false);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReviewSubmit = async (action) => {
    if (action === 'reject' && !reviewFeedback) {
      setSnackbar({ open: true, message: "Please provide feedback for the rejection.", severity: 'warning' });
      return;
    }

    if (action === 'reject' && !confirmRejectOpen) {
      setConfirmRejectOpen(true);
      return;
    }

    if (action === 'accept' && !confirmAcceptOpen) {
      setConfirmAcceptOpen(true);
      return;
    }

    try {
      setReviewLoading(true);
      const slug = typeToSlug[reviewData.check_type] || reviewData.check_type?.toLowerCase() || '';
      await api.post(`/cases/incident-db/${reviewData.case.id}/check/${slug}/review`, {
        action: action,
        feedback: action === 'reject' ? reviewFeedback : null,
      });
      setReviewModalOpen(false);
      setReviewData(null);
      setReviewAction(null);
      setReviewFeedback('');
      setReviewVendorId('');
      setConfirmAcceptOpen(false);
      setConfirmRejectOpen(false);
      fetchData();
      setSnackbar({
        open: true,
        message: action === 'accept' ? "Check has been successfully accepted!" : "Check has been rejected and reassigned successfully!",
        severity: 'success'
      });
    } catch (err) {
      console.error('Failed to submit review:', err);
      setSnackbar({
        open: true,
        message: 'Failed to submit review',
        severity: 'error'
      });
    } finally {
      setReviewLoading(false);
    }
  };

  // Delete case handler (supports single or bulk delete)
  const handleDeleteCase = async () => {
    if (!deleteReason.trim()) {
      setSnackbar({ open: true, message: 'Please provide a reason for deletion.', severity: 'warning' });
      return;
    }

    try {
      setDeleting(true);

      const caseIds = caseToDelete ? [caseToDelete.id] : selected;

      const response = await api.post('/cases/bulk-deletion-request/', {
        case_ids: caseIds,
        reason: deleteReason
      });

      if (response.data.success) {
        setSnackbar({ open: true, message: response.data.message || 'Deletion request(s) submitted successfully.', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: response.data.message || 'Failed to submit deletion requests.', severity: 'error' });
      }

      setDeleteDialogOpen(false);
      setCaseToDelete(null);
      setDeleteReason('');
      setSelected([]);
      await fetchData();
    } catch (error) {
      console.error('Failed to request deletion:', error);
      setSnackbar({ open: true, message: error.response?.data?.detail || error.response?.data?.error || 'Failed to submit deletion request(s). Please try again.', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (caseData = null) => {
    setCaseToDelete(caseData);
    setDeleteDialogOpen(true);
  };

  // Close delete confirmation dialog
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCaseToDelete(null);
    setDeleteReason('');
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Show only the company name in the list (strip trailing "- CODE" or "– CODE").
  const displayClientName = (rawName) => {
    if (!rawName) return '—';
    return String(rawName).replace(/\s*[\u2013-]\s*[A-Za-z0-9]+\s*$/, '').trim() || rawName;
  };

  if (loading && cases.length === 0) {
    return (
      <CaseManagerLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>


      </CaseManagerLayout>
    );
  }

  return (
    <CaseManagerLayout disablePadding>
      {/* Top Header Section - Increased Height for Square Stat Cards */}
      <Box
        sx={{
          minHeight: 110,
          py: 1.75,
          mx: { xs: 1.5, md: 2.5 },
          px: { xs: 2, md: 3 },
          borderRadius: '0 0 16px 16px',
          boxSizing: 'border-box',
          background: 'linear-gradient(120deg, #f0f9ff 0%, #e0e7ff 25%, #bae6fd 55%, #c7d2fe 80%, #e0f2fe 100%)',
          boxShadow: '0 4px 16px rgba(148, 163, 184, 0.10)',
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
            background: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.18) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(56, 189, 248, 0.22) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.15) 0%, transparent 50%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Left Side: Title */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: isClosedView ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isClosedView ? '0 4px 12px rgba(72,187,120,0.15)' : '0 4px 12px rgba(99,102,241,0.15)',
            }}
          >
            {isClosedView ? (
              <CheckCircle sx={{ fontSize: 26, color: '#27ae60' }} />
            ) : (
              <FolderOpen sx={{ fontSize: 26, color: '#4f46e5' }} />
            )}
          </Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.5rem', md: '1.9rem' },
              letterSpacing: '-0.8px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {isClosedView ? 'Closed Cases' : 'Cases'}
          </Typography>
        </Box>

        {/* Right Side: 4 Stat Cards in Single Row + Notification Bell */}
        <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-end' }}>
          {/* Single Row of 4 Stat Cards (Only for Active Cases View) */}
          {!isClosedView && (
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
          )}

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

      {/* Main Page Content with Padding */}
      <Box sx={{ p: 3 }}>

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
                onChange={handleSearch}
                onKeyPress={handleSearchKeyPress}
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

              {/* Full Case Status Filter */}
              {!isClosedView && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select
                    value={fullCaseStatusFilter}
                    onChange={(e) => { setFullCaseStatusFilter(e.target.value); setPage(0); }}
                    displayEmpty
                    sx={{ borderRadius: '8px', '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' } }}
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="WIP">WIP</MenuItem>
                    <MenuItem value="Pending CS">Pending CS</MenuItem>
                    <MenuItem value="Closed">Closed</MenuItem>
                    <MenuItem value="IR-Writing">IR-Writing</MenuItem>
                    <MenuItem value="NI">NI</MenuItem>
                    <MenuItem value="Withdraw">Withdraw</MenuItem>
                    <MenuItem value="QC-1">QC-1</MenuItem>
                    <MenuItem value="Pending Additional Docs">Pending Docs</MenuItem>
                    <MenuItem value="Portal Upload">Portal Upload</MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Investigation Type Filter */}
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={investigationTypeFilter}
                  onChange={(e) => { setInvestigationTypeFilter(e.target.value); setPage(0); }}
                  displayEmpty
                  sx={{ borderRadius: '8px', '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e0e0e0' } }}
                >
                  <MenuItem value="all">All Investigation Types</MenuItem>
                  <MenuItem value="Full Case">Full Case</MenuItem>
                  <MenuItem value="Partial Case">Partial Case</MenuItem>
                  <MenuItem value="Reassessment">Reassessment</MenuItem>
                  <MenuItem value="Connected Case">Connected Case</MenuItem>
                </Select>
              </FormControl>

              {/* Clear Filters */}
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setSearchTerm('');
                  setFullCaseStatusFilter(isClosedView ? 'Closed' : 'all');
                  setInvestigationTypeFilter('all');
                  setPage(0);
                }}
                sx={{
                  color: '#667eea',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#f0f4ff' },
                }}
              >
                Clear Filters
              </Button>

              {/* Delete button (Left side of New Case button when cases are selected) */}
              {selected.length > 0 && (
                <Button
                  variant="contained"
                  startIcon={<Delete />}
                  onClick={() => openDeleteDialog(null)}
                  sx={{
                    ml: 'auto',
                    backgroundColor: '#f56565',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '8px',
                    px: 2,
                    '&:hover': { backgroundColor: '#e53e3e' },
                  }}
                >
                  Delete ({selected.length})
                </Button>
              )}

              {/* New Case Button */}

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateCase}
                sx={{
                  ml: selected.length > 0 ? 1 : 'auto',
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
          <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: '8px' }}>
            <Table sx={{ minWidth: 1200, '& .MuiTableCell-root': { borderRight: '1px solid #edf2f7', py: 1 } }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < cases.length}
                      checked={cases.length > 0 && selected.length === cases.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px', width: 40 }}></TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px', width: 50 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px' }}>Case Number</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px' }}>Claim Number</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px' }}>Client Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px' }}>Investigation Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px' }}>Case Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px' }}>TAT Days</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '15px', borderRight: 'none' }}>Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases.map((row) => {
                  const isItemSelected = isSelected(row.id);
                  const subItems = getSubCases(row);
                  const isExpanded = expandedCases[row.id];
                  const fcColor = fullCaseStatusColors[row.full_case_status] || '#a0aec0';
                  const irColor = irStatusColors[row.investigation_report_status] || '#a0aec0';
                  const ctColor = investigationTypeColors[row.investigation_type] || '#667eea';

                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        hover
                        sx={{ '&:last-child td': { border: 0 } }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={isItemSelected} onChange={() => handleSelect(row.id)} />
                        </TableCell>

                        {/* Expand toggle */}
                        <TableCell sx={{ width: 40, p: 0 }}>
                          {subItems.length > 0 && (
                            <IconButton size="small" onClick={() => toggleCaseExpansion(row.id)}>
                              {isExpanded ? <ExpandMore /> : <ChevronRight />}
                            </IconButton>
                          )}
                        </TableCell>

                        {/* Sequential # */}
                        <TableCell>
                          <Typography sx={{ color: '#667eea', fontWeight: 700, fontSize: '15px' }}>
                            {row.seq_num}
                          </Typography>
                        </TableCell>

                        {/* Case Number */}
                        <TableCell>
                          <Typography
                            onClick={() => openFullCaseModal(row.id)}
                            sx={{
                              fontWeight: 500,
                              fontSize: '15px',
                              color: '#4f46e5',
                              cursor: 'pointer',
                              textDecoration: 'none',
                              '&:hover': { color: '#3730a3' },
                            }}
                            title="Click to view full case details, recordings, documents & evidence"
                          >
                            {row.case_number || '—'}
                          </Typography>
                        </TableCell>

                        {/* Claim Number */}
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, fontSize: '15px' }}>
                            {row.claim_number || '—'}
                          </Typography>
                        </TableCell>

                        {/* Client Name */}
                        <TableCell>
                          <Typography sx={{ fontSize: '15px' }}>{displayClientName(row.client_name)}</Typography>
                        </TableCell>

                        {/* Investigation Type */}
                        <TableCell>
                          <Chip
                            label={row.investigation_type || '—'}
                            size="small"
                            sx={{
                              backgroundColor: `${ctColor}18`,
                              color: ctColor,
                              fontWeight: 600,
                              fontSize: '13px',
                              height: '26px',
                              borderRadius: '6px',
                            }}
                          />
                        </TableCell>

                        {/* Category */}
                        <TableCell>
                          <Typography sx={{ fontSize: '15px' }}>{row.category || '—'}</Typography>
                        </TableCell>

                        {/* Full Case Status */}
                        <TableCell>
                          <Chip
                            label={row.full_case_status || '—'}
                            size="small"
                            sx={{
                              backgroundColor: `${fcColor}20`,
                              color: fcColor,
                              fontWeight: 600,
                              fontSize: '13px',
                              height: '26px',
                              borderRadius: '6px',
                            }}
                          />
                        </TableCell>

                        {/* TAT Days */}
                        <TableCell>
                          <Typography sx={{ fontSize: '15px', textAlign: 'center' }}>
                            {row.tat_days ?? '—'}
                          </Typography>
                        </TableCell>

                        {/* Last Updated */}
                        <TableCell>
                          <Typography sx={{ fontSize: '15px', color: '#666' }}>
                            {formatDate(row.updated_at)}
                          </Typography>
                        </TableCell>
                      </TableRow>

                      {/* ── Sub-items (verification checks) ── */}
                      {subItems.length > 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={13}
                            sx={{ py: 0, borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none', p: 0 }}
                          >
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ backgroundColor: '#f5f7ff', borderLeft: '4px solid #667eea', p: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {(() => {
                                  const chargesheetItems = subItems.filter(s => s.type === 'Chargesheet');
                                  const rtoItems = subItems.filter(s => s.type === 'RTO Check' || s.type === 'rto');
                                  const otherItems = subItems.filter(s => s.type !== 'Chargesheet' && s.type !== 'RTO Check' && s.type !== 'rto');

                                  const renderTable = (items, mode) => {
                                    if (items.length === 0) return null;
                                    const headers = mode === 'chargesheet'
                                      ? ['Sub ID', 'Type', 'Court Name', 'Check Status', 'Legal Partner Status', 'Assigned Legal Partner', 'File RTI']
                                      : mode === 'rto'
                                        ? ['Sub ID', 'Type', 'RTO Name', 'Location', 'Check Status', 'Assigned Business Partner', 'Formats']
                                        : ['Sub ID', 'Type', 'Name / Subject', 'Contact', 'Location', 'Check Status', 'Negative Check Status', 'Assigned Business Partner', 'Review'];

                                    return (
                                      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #d0d5f5', borderRadius: '6px', mb: 2 }}>
                                        <Table size="small">
                                          <TableHead sx={{ backgroundColor: '#eef0fb' }}>
                                            <TableRow>
                                              {headers.map((h) => (
                                                <TableCell key={h} align="center" sx={{ fontSize: '13px', fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.4px', borderRight: '1px solid #d0d5f5', py: 2 }}>
                                                  {h}
                                                </TableCell>
                                              ))}
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {items.map((sub, idx) => {
                                              const sc = checkStatusColors[sub.check_status] || '#a0aec0';
                                              const isVendorAssigned = Boolean(sub.assigned_vendor_name || sub.assigned_vendor_id);
                                              return (
                                                <TableRow
                                                  key={sub.sub_id}
                                                  hover
                                                  onClick={() => {
                                                    const slug = typeToSlug[sub.type];
                                                    if (slug) navigate(`/case_manager/cases/${row.id}/check/${slug}`);
                                                  }}
                                                  sx={{
                                                    cursor: 'pointer',
                                                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9faff',
                                                    '& td': { borderRight: '1px solid #eceef8', py: 2 },
                                                    '&:last-child td, &:last-child th': { borderBottom: 0 }
                                                  }}
                                                >
                                                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '15px', color: '#667eea' }}>{sub.sub_id}</TableCell>
                                                  <TableCell align="center" sx={{ fontSize: '14px', fontWeight: 600, color: '#444' }}>{sub.type}</TableCell>

                                                  {mode === 'chargesheet' ? (
                                                    <TableCell align="center" sx={{ fontSize: '14px', color: '#333' }}><Typography align="center" noWrap title={sub.name} sx={{ fontSize: 'inherit', maxWidth: '150px', mx: 'auto' }}>{sub.name}</Typography></TableCell>
                                                  ) : mode === 'rto' ? (
                                                    <>
                                                      <TableCell align="center" sx={{ fontSize: '14px', color: '#333' }}><Typography align="center" noWrap title={sub.name} sx={{ fontSize: 'inherit', maxWidth: '150px', mx: 'auto' }}>{sub.name}</Typography></TableCell>
                                                      <TableCell align="center" sx={{ fontSize: '14px', color: '#555' }}><Typography align="center" noWrap title={sub.location} sx={{ fontSize: 'inherit', maxWidth: '150px', mx: 'auto' }}>{sub.location}</Typography></TableCell>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <TableCell align="center" sx={{ fontSize: '14px', color: '#333' }}><Typography align="center" noWrap title={sub.name} sx={{ fontSize: 'inherit', maxWidth: '150px', mx: 'auto' }}>{sub.name}</Typography></TableCell>
                                                      <TableCell align="center" sx={{ fontSize: '14px', color: '#555' }}><Typography align="center" noWrap title={sub.contact} sx={{ fontSize: 'inherit', maxWidth: '120px', mx: 'auto' }}>{sub.contact}</Typography></TableCell>
                                                      <TableCell align="center" sx={{ fontSize: '14px', color: '#555' }}><Typography align="center" noWrap title={sub.location} sx={{ fontSize: 'inherit', maxWidth: '150px', mx: 'auto' }}>{sub.location}</Typography></TableCell>
                                                    </>
                                                  )}

                                                  <TableCell align="center">
                                                    <Chip label={sub.check_status} size="small" sx={{ backgroundColor: `${sc}22`, color: sc, fontWeight: 700, fontSize: '13px', height: '26px', borderRadius: '6px' }} />
                                                  </TableCell>

                                                  {mode === 'chargesheet' && (
                                                    <TableCell align="center" sx={{ fontSize: '14px', color: '#555' }}>
                                                      <Typography align="center" noWrap title={sub.advocate_status || 'N/A'} sx={{ fontSize: 'inherit', maxWidth: '120px', mx: 'auto' }}>
                                                        {sub.advocate_status || 'N/A'}
                                                      </Typography>
                                                    </TableCell>
                                                  )}

                                                  {mode === 'other' && (
                                                    <TableCell align="center" onClick={(e) => {
                                                      if (sub.negative_status === 'Non co-operative' || sub.negative_status === 'Non Traceable') {
                                                        e.stopPropagation();
                                                        handleOpenSection134(row.id);
                                                      }
                                                    }}>
                                                      {sub.negative_status === 'Non co-operative' || sub.negative_status === 'Non Traceable' ? (
                                                        <Button
                                                          size="small"
                                                          variant="contained"
                                                          sx={{
                                                            textTransform: 'none',
                                                            fontSize: '12px',
                                                            fontWeight: 700,
                                                            backgroundColor: '#ef4444',
                                                            color: 'white',
                                                            py: 0.2,
                                                            px: 1,
                                                            minWidth: 'auto',
                                                            mx: 'auto',
                                                            lineHeight: 1.2,
                                                            '&:hover': { backgroundColor: '#dc2626' }
                                                          }}
                                                          title="Generate Section 134 Notice"
                                                        >
                                                          {sub.negative_status}
                                                        </Button>
                                                      ) : sub.negative_status === 'Shifted' ? (
                                                        <Chip
                                                          label="Shifted"
                                                          size="small"
                                                          sx={{
                                                            fontSize: '12px',
                                                            fontWeight: 800,
                                                            backgroundColor: '#fee2e2',
                                                            color: '#991b1b',
                                                            border: '1px solid #fca5a5',
                                                            mx: 'auto'
                                                          }}
                                                        />
                                                      ) : (
                                                        <Typography align="center" noWrap title={sub.negative_status || 'N/A'} sx={{ fontSize: '14px', color: '#555', maxWidth: '120px', mx: 'auto' }}>
                                                          {sub.negative_status || 'N/A'}
                                                        </Typography>
                                                      )}
                                                    </TableCell>
                                                  )}

                                                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                                    {sub.assigned_vendor_name ? (
                                                      <Button size="small" variant="text" startIcon={<Edit sx={{ fontSize: 14 }} />} onClick={() => openVendorModal(row.id, sub.type, sub.assigned_vendor_id)} sx={{ textTransform: 'none', fontSize: '13px', fontWeight: 700, color: '#2e7d32', py: 0, px: 0.5, minWidth: 0, justifyContent: 'center', mx: 'auto' }} title={`Change vendor from ${sub.assigned_vendor_name}`}>
                                                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{sub.assigned_vendor_name}</Box>
                                                      </Button>
                                                    ) : (
                                                      <Button size="small" variant="outlined" onClick={() => openVendorModal(row.id, sub.type)} sx={{ textTransform: 'none', fontSize: '13px', fontWeight: 600, borderColor: '#667eea', color: '#667eea', py: 0.5, px: 1.5, minWidth: 'auto', mx: 'auto' }}>Assign</Button>
                                                    )}
                                                  </TableCell>

                                                  {mode === 'chargesheet' && (
                                                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                                      <Button
                                                        size="small"
                                                        variant="outlined"
                                                        disabled={!sub.advocate_status || sub.advocate_status.toLowerCase() !== 'not found'}
                                                        onClick={() => handleOpenFileRti(row.id, sub.sub_id)}
                                                        sx={{
                                                          textTransform: 'none',
                                                          fontSize: '13px',
                                                          fontWeight: 600,
                                                          borderColor: '#f59e0b',
                                                          color: '#f59e0b',
                                                          py: 0.5,
                                                          px: 1.5,
                                                          minWidth: 'auto',
                                                          mx: 'auto',
                                                          '&:hover': {
                                                            backgroundColor: '#fef3c7',
                                                            borderColor: '#d97706',
                                                          },
                                                          '&.Mui-disabled': {
                                                            borderColor: '#e2e8f0',
                                                            color: '#94a3b8',
                                                          }
                                                        }}
                                                      >
                                                        File RTI
                                                      </Button>
                                                    </TableCell>
                                                  )}

                                                  {mode === 'rto' && (
                                                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                                      <Button
                                                        size="medium"
                                                        variant="contained"
                                                        startIcon={<Description sx={{ fontSize: 16 }} />}
                                                        onClick={() => handleOpenRtoDocModal(row.id)}
                                                        sx={{
                                                          textTransform: 'none',
                                                          fontSize: '13.5px',
                                                          fontWeight: 700,
                                                          backgroundColor: '#4527a0',
                                                          color: '#fff',
                                                          py: 0.75,
                                                          px: 2,
                                                          minWidth: 0,
                                                          boxShadow: 'none',
                                                          mx: 'auto',
                                                          '&:hover': {
                                                            backgroundColor: '#311b92',
                                                          }
                                                        }}
                                                      >
                                                        Formats
                                                      </Button>
                                                    </TableCell>
                                                  )}

                                                  {mode === 'other' && (
                                                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                                      <Tooltip title={!isVendorAssigned ? "Assign business partner to enable this button" : ""} arrow placement="top">
                                                        <Box component="span" sx={{ display: 'inline-block', cursor: !isVendorAssigned ? 'not-allowed' : 'default' }}>
                                                          {sub.check_status === 'Verified' ? (
                                                            <Button size="small" variant="text" disabled={!isVendorAssigned} onClick={() => openReviewModal(row.id, sub.type)} sx={{ textTransform: 'none', p: 0, minWidth: 'auto', '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'not-allowed' } }}>
                                                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#48bb78', fontSize: '13.5px', textDecoration: 'underline' }}>Accepted</Typography>
                                                            </Button>
                                                          ) : (
                                                            <Button
                                                              size="medium"
                                                              variant="contained"
                                                              disabled={!isVendorAssigned}
                                                              startIcon={<Visibility sx={{ fontSize: 16 }} />}
                                                              onClick={() => openReviewModal(row.id, sub.type)}
                                                              sx={{
                                                                textTransform: 'none',
                                                                fontSize: '13.5px',
                                                                fontWeight: 700,
                                                                backgroundColor: '#667eea',
                                                                color: '#fff',
                                                                py: 0.75,
                                                                px: 2,
                                                                minWidth: 0,
                                                                boxShadow: 'none',
                                                                mx: 'auto',
                                                                '&:hover': {
                                                                  backgroundColor: '#5a67d8',
                                                                }
                                                              }}
                                                            >
                                                              Review
                                                            </Button>
                                                          )}
                                                        </Box>
                                                      </Tooltip>
                                                    </TableCell>
                                                  )}
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </TableContainer>
                                    );
                                  };

                                  return (
                                    <>
                                      {renderTable(otherItems, 'other')}
                                      {renderTable(chargesheetItems, 'chargesheet')}
                                      {renderTable(rtoItems, 'rto')}
                                    </>
                                  );
                                })()}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {!loading && cases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No cases found. Try adjusting your filters or create a new case.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
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
              py: 1,
              borderTop: '1px solid #e0e0e0',
            }}
          >
            <Typography sx={{ fontSize: '14px', color: '#666' }}>
              {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalCases)} of {totalCases.toLocaleString()}
            </Typography>
            <TablePagination
              component="div"
              count={totalCases}
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

        {/* Vendor Assignment Modal */}
        <Dialog
          open={vendorModalOpen}
          onClose={() => setVendorModalOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1 }}>
            {selectedVendorId
              ? (vendorModalTarget?.checkType === 'Chargesheet' ? 'Change Legal Partner' : 'Change Business Partner')
              : (vendorModalTarget?.checkType === 'Chargesheet' ? 'Assign Legal Partner' : 'Assign Business Partner')}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '13px', color: '#666', mb: 2 }}>
              Select {vendorModalTarget?.checkType === 'Chargesheet' ? 'a legal partner' : 'a business partner'} for this check, or clear the assignment to remove it from the current {vendorModalTarget?.checkType === 'Chargesheet' ? 'legal partner' : 'business partner'}.
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                displayEmpty
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {vendorList.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.company_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setVendorModalOpen(false)}
              sx={{ textTransform: 'none', color: '#666' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={vendorAssigning}
              onClick={handleAssignVendorToCheck}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: '#667eea',
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#5568d3' },
              }}
            >
              {vendorAssigning ? <CircularProgress size={20} color="inherit" /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Case Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={closeDeleteDialog}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '18px', pb: 1 }}>
            Request Deletion: {caseToDelete ? 'Case' : 'Selected Cases'}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '14px', color: '#666', mb: 2 }}>
              {caseToDelete ? (
                <>Request deletion for case <strong>{caseToDelete.case_number}</strong>?</>
              ) : (
                <>Request deletion for <strong>{selected.length} selected case(s)</strong>?</>
              )}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: '#999', mb: 2 }}>
              This request will be sent to the Super Admin for approval.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason for Deletion"
              variant="outlined"
              size="small"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Provide a valid reason..."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={closeDeleteDialog}
              disabled={deleting}
              sx={{ textTransform: 'none', color: '#666' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={deleting}
              onClick={handleDeleteCase}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: '#f56565',
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#e53e3e' },
              }}
            >
              {deleting ? <CircularProgress size={20} color="inherit" /> : 'Submit Request'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Review Check Modal */}
        <Dialog
          open={reviewModalOpen}
          onClose={() => { setReviewModalOpen(false); setReviewData(null); }}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: '12px', overflow: 'hidden' }
          }}
        >
          <DialogTitle sx={{ m: 0, p: 2, bgcolor: '#667eea', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h6" fontWeight="700">
                Check Details &amp; Evidence Review
              </Typography>
              {reviewData?.check?.check_status && (
                <Chip
                  label={reviewData.check.check_status}
                  size="small"
                  sx={{
                    bgcolor: reviewData.check.check_status === 'Closed' ? '#48bb78' : '#f6ad55',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '11px',
                  }}
                />
              )}
            </Box>
            <IconButton size="small" onClick={() => { setReviewModalOpen(false); setReviewData(null); }} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers sx={{ p: 3, backgroundColor: '#f8f9fa' }}>
            {reviewLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                <CircularProgress size={40} />
              </Box>
            ) : reviewData ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Case & Check Header Info */}
                <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <Table size="small" sx={{ minWidth: 400 }}>
                    <TableBody>
                      <TableRow sx={{ bgcolor: '#f7fafc' }}>
                        <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                          Case Number
                        </TableCell>
                        <TableCell sx={{ color: '#2d3748', fontWeight: 700, wordBreak: 'break-word', py: 1.5 }}>
                          {reviewData.case?.case_number || '—'}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#ffffff' }}>
                        <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                          Claim Number
                        </TableCell>
                        <TableCell sx={{ color: '#2d3748', fontWeight: 700, wordBreak: 'break-word', py: 1.5 }}>
                          {reviewData.case?.claim_number || '—'}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f7fafc' }}>
                        <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                          Client
                        </TableCell>
                        <TableCell sx={{ color: '#2d3748', fontWeight: 700, wordBreak: 'break-word', py: 1.5 }}>
                          {reviewData.case?.client_name || '—'}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 }, bgcolor: '#ffffff' }}>
                        <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                          Check Type
                        </TableCell>
                        <TableCell sx={{ color: '#667eea', fontWeight: 700, textTransform: 'capitalize', wordBreak: 'break-word', py: 1.5 }}>
                          {reviewData.check_type || '—'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>

                {/* Check Fields Info */}
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Check Information
                  </Typography>
                  <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <Table size="small" sx={{ minWidth: 400 }}>
                      <TableBody>
                        {Object.entries(reviewData.check || {})
                          .filter(([k, v]) =>
                            !['id', 'case_id', 'created_at', 'updated_at', 'vendor_evidence', 'evidence', 'evidence_photos', 'statement_audio', 'statement_audio_url', 'statement', 'statement_mr', 'statement_en', 'statement_transcript_updated_at', 'statement_entries', 'statement_transcript_mr', 'statement_transcript_provider', 'statement_transcript_confidence', 'claimant_lat', 'claimant_lng', 'insured_lat', 'insured_lng', 'driver_lat', 'driver_lng', 'spot_lat', 'spot_lng', 'statement_transcript_en', 'statement_audio_path', 'case_manager_feedback', 'is_reassigned', 'questionnaire', 'admin_feedback', 'negative_status', 'vendor_feedback'].includes(k)
                          )
                          .map(([key, rawVal], index) => {
                            let val = rawVal;
                            if (typeof rawVal === 'string' && rawVal.startsWith('[') && rawVal.endsWith(']')) {
                              try {
                                val = JSON.parse(rawVal);
                              } catch (e) { }
                            }
                            const displayVal = val === null || val === undefined || val === '' || val === '[]' || val === '{}'
                              ? 'NA'
                              : Array.isArray(val)
                                ? (val.length > 0 ? val.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ') : 'NA')
                                : (typeof val === 'object' && val !== null ? (Object.keys(val).length > 0 ? JSON.stringify(val) : 'NA') : String(val));

                            return (
                              <TableRow key={key} sx={{ '&:last-child td': { border: 0 }, bgcolor: index % 2 === 0 ? '#f7fafc' : '#ffffff' }}>
                                <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                                  {key.replace(/_/g, ' ')}
                                </TableCell>
                                <TableCell sx={{ color: '#2d3748', wordBreak: 'break-word', py: 1.5 }}>
                                  {key.toLowerCase().includes('document') && Array.isArray(val) && val.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {val.map((doc, dIdx) => (
                                        <Button
                                          key={dIdx}
                                          size="small"
                                          variant="outlined"
                                          component="a"
                                          href={doc.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          startIcon={<InsertDriveFile fontSize="small" />}
                                          sx={{ textTransform: 'none', borderRadius: '4px', p: 0.5, px: 1 }}
                                        >
                                          Preview {doc.filename || 'Document'}
                                        </Button>
                                      ))}
                                    </Box>
                                  ) : (key === 'applied_cs_photos' || key === 'dispatched_photos') ? (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {(Array.isArray(val) ? val : (typeof val === 'string' && val.trim() ? [{ url: val }] : [])).map((photoObj, idx) => {
                                        const pUrl = photoObj.preview_url || photoObj.url;
                                        return pUrl ? (
                                          <Box key={idx} sx={{ width: '150px', cursor: 'pointer' }} onClick={() => setActivePhotoPreview(resolveMediaUrl(pUrl))}>
                                            <img src={resolveMediaUrl(pUrl)} alt={`${key} ${idx}`} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', display: 'block', border: '1px solid #e2e8f0' }} />
                                          </Box>
                                        ) : null;
                                      })}
                                    </Box>
                                  ) : typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/media/')) ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="a"
                                      href={val}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      startIcon={<InsertDriveFile fontSize="small" />}
                                      sx={{ textTransform: 'none', borderRadius: '4px', p: 0.5, px: 1 }}
                                    >
                                      Preview
                                    </Button>
                                  ) : (
                                    displayVal
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        }
                      </TableBody>
                    </Table>
                  </Box>
                </Paper>

                {/* Dedicated Questionnaire Form Section */}
                {reviewData.check_type?.toLowerCase() !== 'chargesheet' && (() => {
                  const qData = parseQuestionnaire(reviewData?.check?.questionnaire);
                  const hasData = qData && typeof qData === 'object' && Object.keys(qData).length > 0;
                  const displayObj = hasData
                    ? qData
                    : Object.keys(QUESTIONNAIRE_LABELS).reduce((acc, k) => ({ ...acc, [k]: '—' }), {});

                  return (
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📋 Questionnaire Form
                        </Typography>
                        <Chip
                          label={hasData ? "Vendor Submitted" : "Pending Submission"}
                          size="small"
                          sx={{
                            bgcolor: hasData ? '#e0f2fe' : '#f1f5f9',
                            color: hasData ? '#0369a1' : '#64748b',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}
                        />
                      </Box>
                      <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <Table size="small" sx={{ minWidth: 400 }}>
                          <TableBody>
                            {Object.entries(displayObj).map(([qKey, qVal], qIdx) => {
                              const label = QUESTIONNAIRE_LABELS[qKey] || qKey.replace(/_/g, ' ');
                              const valStr = qVal != null && qVal !== '' ? String(qVal) : '—';
                              return (
                                <TableRow key={qKey} sx={{ '&:last-child td': { border: 0 }, bgcolor: qIdx % 2 === 0 ? '#f7fafc' : '#ffffff' }}>
                                  <TableCell component="th" scope="row" sx={{ width: '40%', color: '#4a5568', fontWeight: 600, textTransform: 'capitalize', borderRight: '1px solid #edf2f7', py: 1.5 }}>
                                    {label}
                                  </TableCell>
                                  <TableCell sx={{ color: '#2d3748', wordBreak: 'break-word', py: 1.5, whiteSpace: qKey === 'description_of_accident' ? 'pre-wrap' : 'normal' }}>
                                    {valStr}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    </Paper>
                  );
                })()}

                {/* Vendor Statements */}
                {reviewData.check_type?.toLowerCase() !== 'chargesheet' && (
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Vendor Statements
                    </Typography>

                    {/* Main Statement */}
                    {reviewData.check?.statement && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600 }}>STATEMENT</Typography>
                        <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#f7fafc', borderRadius: '6px', border: '1px solid #edf2f7', color: '#2d3748', whiteSpace: 'pre-line' }}>
                          {reviewData.check.statement}
                        </Typography>
                      </Box>
                    )}

                    {/* Marathi Transcript */}
                    {reviewData.check?.statement_mr && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600 }}>STATEMENT (MARATHI TRANSCRIPT)</Typography>
                        <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#f7fafc', borderRadius: '6px', border: '1px solid #edf2f7', color: '#2d3748', whiteSpace: 'pre-line' }}>
                          {reviewData.check.statement_mr}
                        </Typography>
                      </Box>
                    )}

                    {/* English Transcript */}
                    {reviewData.check?.statement_en && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600 }}>STATEMENT (ENGLISH TRANSCRIPT)</Typography>
                        <Typography variant="body2" sx={{ p: 1.5, bgcolor: '#f7fafc', borderRadius: '6px', border: '1px solid #edf2f7', color: '#2d3748', whiteSpace: 'pre-line' }}>
                          {reviewData.check.statement_en}
                        </Typography>
                      </Box>
                    )}

                    {/* Audio Recording */}
                    {reviewData.check?.statement_audio_url && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600, display: 'block', mb: 0.5 }}>AUDIO RECORDING</Typography>
                        <audio controls src={reviewData.check.statement_audio_url} style={{ width: '100%', borderRadius: '8px' }} />
                      </Box>
                    )}

                    {!reviewData.check?.statement && !reviewData.check?.statement_mr && !reviewData.check?.statement_en && !reviewData.check?.statement_audio_url && (
                      <Typography variant="body2" sx={{ color: '#a0aec0', fontStyle: 'italic' }}>
                        No vendor statements available for this check.
                      </Typography>
                    )}
                  </Paper>
                )}
                {/* Visit Photos Preview */}
                {reviewData.check_type?.toLowerCase() !== 'chargesheet' && (
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#667eea', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Visit Photos ({reviewData.check?.evidence_photos?.length || 0})
                    </Typography>

                    {reviewData.check?.evidence_photos && reviewData.check.evidence_photos.length > 0 ? (
                      <Grid container spacing={2}>
                        {reviewData.check.evidence_photos.map((photo, pIdx) => (
                          <Grid item xs={6} sm={4} md={3} key={pIdx}>
                            <Paper
                              elevation={0}
                              onClick={() => setActivePhotoPreview(photo.preview_url || photo.url)}
                              sx={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': { transform: 'scale(1.02)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                              }}
                            >
                              <Box
                                component="img"
                                src={photo.preview_url || photo.url}
                                alt={photo.filename || `Visit Photo ${pIdx + 1}`}
                                sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block', bgcolor: '#f7fafc' }}
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Image+Error'; }}
                              />
                              <Box sx={{ p: 1, bgcolor: '#fafafa', borderTop: '1px solid #e2e8f0' }}>
                                <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, color: '#4a5568', fontSize: '11px' }}>
                                  {photo.filename || `Photo ${pIdx + 1}`}
                                </Typography>
                                {(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date) && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5 }}>
                                    🕒 {new Date(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date).toLocaleString()}
                                  </Typography>
                                )}
                                {(photo.location_name || photo.location || (photo.latitude != null && photo.longitude != null && photo.latitude !== '' && photo.longitude !== '')) && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                    📍 {photo.location_name || photo.location || `${Number(photo.latitude).toFixed(4)}, ${Number(photo.longitude).toFixed(4)}`}
                                  </Typography>
                                )}
                              </Box>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#a0aec0', fontStyle: 'italic' }}>
                        No visit photos uploaded for this check yet.
                      </Typography>
                    )}
                  </Paper>
                )}
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            {reviewAction === 'reject' && (
              <Paper elevation={0} sx={{ p: 2, mb: 1.5, bgcolor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px', width: '100%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#c53030', mb: 1 }}>
                  Provide Rejection / Reassignment Feedback for Vendor
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Enter specific feedback on why this check is rejected and what the vendor needs to correct or re-verify..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  size="small"
                  sx={{ bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                />
              </Paper>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Button onClick={() => setReviewModalOpen(false)} sx={{ textTransform: 'none', color: '#718096' }}>
                Cancel
              </Button>

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {reviewAction === 'reject' ? (
                  <>
                    <Button
                      variant="outlined"
                      onClick={() => setReviewAction(null)}
                      sx={{ textTransform: 'none' }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      disabled={reviewLoading || !reviewFeedback.trim()}
                      onClick={() => handleReviewSubmit('reject')}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Confirm Rejection &amp; Reassign
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => setReviewAction('reject')}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Reject &amp; Reassign
                    </Button>
                    {reviewData?.check?.check_status !== 'Verified' && reviewData?.check?.check_status !== 'Accepted' && (
                      <Button
                        variant="contained"
                        color="success"
                        disabled={reviewLoading}
                        onClick={() => handleReviewSubmit('accept')}
                        sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#48bb78', '&:hover': { bgcolor: '#38a169' } }}
                      >
                        Accept Check
                      </Button>
                    )}
                  </>
                )}
              </Box>
            </Box>
          </DialogActions>
        </Dialog>

        {/* FULL CASE VIEW MODAL */}
        <Dialog
          open={fullCaseModalOpen}
          onClose={() => setFullCaseModalOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' } }}
        >
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              color: '#fff',
              px: 3,
              py: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '18px' }}>
                📁 Case Details — {fullCaseData?.case?.claim_number || 'Case'}
              </Typography>
              {fullCaseData?.case?.full_case_status && (
                <Chip
                  label={fullCaseData.case.full_case_status}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '11px',
                    backdropFilter: 'blur(4px)',
                  }}
                />
              )}
            </Box>
            <IconButton onClick={() => setFullCaseModalOpen(false)} sx={{ color: 'rgba(255, 255, 255, 0.8)', '&:hover': { color: '#fff', bgcolor: 'rgba(255, 255, 255, 0.1)' } }}>
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
            {fullCaseLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={40} sx={{ color: '#2563eb' }} />
              </Box>
            ) : !fullCaseData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <Typography variant="body1" sx={{ color: '#94a3b8' }}>No case data available.</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                {/* Navigation Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0' }}>
                  <Tabs
                    value={fullCaseTab}
                    onChange={(e, val) => setFullCaseTab(val)}
                    sx={{
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '14px',
                        minHeight: '44px',
                        color: '#64748b',
                        '&.Mui-selected': { color: '#2563eb' },
                      },
                      '& .MuiTabs-indicator': { bgcolor: '#2563eb', height: 3, borderRadius: '3px 3px 0 0' },
                    }}
                  >
                    <Tab label="1. General Case Information" />
                    <Tab label={`2. Verification Checks (${fullCaseData.checks?.length || 0})`} />
                    <Tab label="3. Evidence Gallery" />
                  </Tabs>
                </Box>

                {/* TAB 0: General Case Information */}
                {fullCaseTab === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                    {/* Section 1: General Information & Parties */}
                    <Paper elevation={0} sx={{ p: 3, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2563eb' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                            1. General Information &amp; Parties
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`Full Case: ${fullCaseData.case?.full_case_status || '—'}`}
                            size="small"
                            sx={{ fontWeight: 700, bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                          />
                          <Chip
                            label={`IR: ${fullCaseData.case?.investigation_report_status || '—'}`}
                            size="small"
                            sx={{ fontWeight: 700, bgcolor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                          />
                          <Chip
                            label={`SLA: ${fullCaseData.case?.sla || '—'}`}
                            size="small"
                            sx={{ fontWeight: 700, bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                          />
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(4, 1fr)',
                          },
                          gap: 2,
                        }}
                      >
                        {[
                          { label: 'Case Number', value: fullCaseData.case?.case_number || '—' },
                          { label: 'Claim Number', value: fullCaseData.case?.claim_number || '—' },
                          { label: 'Client Name', value: fullCaseData.case?.client_name || '—' },
                          { label: 'Client Code', value: fullCaseData.case?.client_code || '—' },
                          { label: 'Claimant Name', value: fullCaseData.case?.claimant_name || '—' },
                          { label: 'Insured Name', value: fullCaseData.case?.insured_name || '—' },
                          { label: 'Driver Name', value: fullCaseData.case?.driver_name || '—' },
                          { label: 'Investigation Type / Category', value: `${fullCaseData.case?.investigation_type || '—'} • ${fullCaseData.case?.category || '—'}` },
                        ].map((item, i) => (
                          <Box
                            key={i}
                            sx={{
                              p: 1.75,
                              borderRadius: '10px',
                              bgcolor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                borderColor: '#cbd5e1',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                              },
                            }}
                          >
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem', display: 'block', letterSpacing: '0.3px' }}>
                              {item.label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5, wordBreak: 'break-word' }}>
                              {item.value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Paper>

                    {/* Section 2: Timeline & Turnaround Schedule */}
                    <Paper elevation={0} sx={{ p: 3, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#0284c7' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                          2. Timeline &amp; Turnaround (TAT) Schedule
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            md: 'repeat(3, 1fr)',
                          },
                          gap: 2.5,
                        }}
                      >
                        {/* Intake Column */}
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: '12px',
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)' },
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
                            Case Intake
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Receive Date</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.25 }}>{formatDate(fullCaseData.case?.case_receive_date)}</Typography>
                            </Box>
                            <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Receive Month (Auto)</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', mt: 0.25 }}>
                                {fullCaseData.case?.case_receive_date ? new Date(fullCaseData.case.case_receive_date).toLocaleString('default', { month: 'long', year: 'numeric' }) : '—'}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* Completion Column */}
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: '12px',
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)' },
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
                            Case Completion
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Closure Date</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.25 }}>{formatDate(fullCaseData.case?.closure_date)}</Typography>
                            </Box>
                            <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Closure Month (Auto)</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', mt: 0.25 }}>
                                {fullCaseData.case?.closure_date ? new Date(fullCaseData.case.closure_date).toLocaleString('default', { month: 'long', year: 'numeric' }) : '—'}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* SLA & TAT Column */}
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: '12px',
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)' },
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
                            SLA &amp; Turnaround (TAT)
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>Case Due Date (Auto)</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.25 }}>{formatDate(fullCaseData.case?.case_due_date)}</Typography>
                            </Box>
                            <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>TAT Days (Auto)</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.25 }}>{fullCaseData.case?.tat_days ?? '—'} days</Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Paper>

                    {/* Section 3: Uploaded Case Documents */}
                    <Paper elevation={0} sx={{ p: 3, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#d97706' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                          3. Uploaded Case Documents
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(3, 1fr)',
                          },
                          gap: 2.5,
                        }}
                      >
                        {[
                          { title: 'Policy Document', url: fullCaseData.case?.policy_document_url, filename: fullCaseData.case?.policy_document, helper: 'Insurance policy copy' },
                          { title: 'Petition Document', url: fullCaseData.case?.petition_document_url, filename: fullCaseData.case?.petition_document, helper: 'Claim petition or legal copy' },
                          { title: 'Other Case Document', url: fullCaseData.case?.other_document_url, filename: fullCaseData.case?.other_document, helper: 'Supporting case files' },
                        ].map((doc, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              p: 2.25,
                              borderRadius: '12px',
                              border: doc.url ? '1.5px solid #22c55e' : '1px dashed #cbd5e1',
                              bgcolor: doc.url ? '#f0fdf4' : '#ffffff',
                              boxShadow: doc.url ? '0 2px 6px rgba(34, 197, 94, 0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1.25,
                              minHeight: '140px',
                              boxSizing: 'border-box',
                              transition: 'all 0.2s',
                              '&:hover': {
                                boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: doc.url ? '#15803d' : '#1e293b' }}>
                                {doc.title}
                              </Typography>
                              {doc.url && (
                                <Chip
                                  label="Uploaded"
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#dcfce7', color: '#166534', fontWeight: 700, border: '1px solid #86efac' }}
                                />
                              )}
                            </Box>

                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                              {doc.helper}
                            </Typography>

                            {doc.url ? (
                              Array.isArray(doc.url) ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 'auto' }}>
                                  {doc.url.map((u, i) => (
                                    <Button
                                      key={i}
                                      size="small"
                                      variant="outlined"
                                      component="a"
                                      href={u}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      startIcon={<InsertDriveFile sx={{ fontSize: '1rem' }} />}
                                      sx={{ textTransform: 'none', borderColor: '#16a34a', color: '#15803d', '&:hover': { bgcolor: '#dcfce7', borderColor: '#15803d' }, borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem' }}
                                    >
                                      View Document {i + 1}
                                    </Button>
                                  ))}
                                </Box>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  component="a"
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  startIcon={<InsertDriveFile sx={{ fontSize: '1rem' }} />}
                                  sx={{ mt: 'auto', textTransform: 'none', borderColor: '#16a34a', color: '#15803d', '&:hover': { bgcolor: '#dcfce7', borderColor: '#15803d' }, borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem' }}
                                >
                                  View / Download Document
                                </Button>
                              )
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic', mt: 'auto', py: 0.5 }}>
                                No file uploaded
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Paper>

                    {/* Section 4: Special Instructions */}
                    {fullCaseData.case?.special_instructions && (
                      <Paper elevation={0} sx={{ p: 3, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                          🎯 Special Instructions
                        </Typography>
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                          <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                            {fullCaseData.case.special_instructions}
                          </Typography>
                        </Box>
                      </Paper>
                    )}

                  </Box>
                )}

                {/* TAB 1: Verification Checks */}
                {fullCaseTab === 1 && (() => {
                  const dedupedChecks = [];
                  const seenCum = new Set();
                  if (fullCaseData.checks) {
                    for (const item of fullCaseData.checks) {
                      if (item.check?.insured_cum_driver) {
                        if (seenCum.has(item.check.case_id)) continue;
                        seenCum.add(item.check.case_id);
                        dedupedChecks.push({ ...item, check_type_label: 'Insured cum driver check' });
                      } else {
                        dedupedChecks.push(item);
                      }
                    }
                  }
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dedupedChecks.length > 0 ? (
                        <>
                          {/* Check Sub Tabs */}
                          <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0', mb: 2 }}>
                            <Tabs
                              value={selectedCheckTab}
                              onChange={(e, v) => setSelectedCheckTab(v)}
                              variant="scrollable"
                              scrollButtons="auto"
                              sx={{
                                '& .MuiTab-root': {
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  minHeight: '40px',
                                  '&.Mui-selected': { color: '#2563eb' },
                                },
                                '& .MuiTabs-indicator': { bgcolor: '#2563eb' },
                              }}
                            >
                              {dedupedChecks.map((item, cIdx) => (
                                <Tab
                                  key={cIdx}
                                  label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <span>{item.check_type_label}</span>
                                      <Chip
                                        label={item.check?.check_status || 'Pending'}
                                        size="small"
                                        sx={{
                                          height: '20px',
                                          fontSize: '10px',
                                          bgcolor: item.check?.check_status === 'Verified' || item.check?.check_status === 'Closed' ? '#dcfce7' : '#fef3c7',
                                          color: item.check?.check_status === 'Verified' || item.check?.check_status === 'Closed' ? '#166534' : '#92400e',
                                          fontWeight: 700
                                        }}
                                      />
                                    </Box>
                                  }
                                />
                              ))}
                            </Tabs>
                          </Box>

                          {/* Selected Check Contents */}
                          {(() => {
                            const currentCheckObj = dedupedChecks[selectedCheckTab];
                            if (!currentCheckObj) return null;
                            const checkData = currentCheckObj.check || {};
                            return (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {/* Check Status & Vendor Header */}
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 6px -1px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                                  <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.1rem' }}>
                                      {currentCheckObj.check_type_label}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.25 }}>
                                      Assigned Business Partner: <strong style={{ color: '#1e293b' }}>{checkData.assigned_vendor_name || 'Unassigned'}</strong>
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={`Status: ${checkData.check_status || 'Not Initiated'}`}
                                    sx={{
                                      bgcolor: checkData.check_status === 'Verified' || checkData.check_status === 'Closed' ? '#16a34a' : '#ea580c',
                                      color: '#fff',
                                      fontWeight: 700,
                                      px: 1.5,
                                      height: 28,
                                    }}
                                  />
                                </Paper>

                                {/* Vendor Feedback (if any) */}
                                {(checkData.negative_status || checkData.vendor_feedback) && (
                                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #fca5a5', bgcolor: '#fff5f5', boxShadow: '0 2px 6px -1px rgba(239, 68, 68, 0.08)' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        ⚠️ Vendor Feedback
                                      </Typography>
                                      {checkData.negative_status && (
                                        <Chip
                                          label={checkData.negative_status}
                                          size="small"
                                          sx={{ bgcolor: '#fef2f2', color: '#991b1b', fontWeight: 800, border: '1px solid #fca5a5' }}
                                        />
                                      )}
                                    </Box>
                                    {checkData.vendor_feedback && (
                                      <Typography variant="body2" sx={{ color: '#7f1d1d', whiteSpace: 'pre-wrap', mt: 1, p: 1.5, bgcolor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                        {checkData.vendor_feedback}
                                      </Typography>
                                    )}
                                  </Paper>
                                )}

                                {/* Verification Data Table */}
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 6px -1px rgba(0,0,0,0.05)' }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563eb', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                                    📌 Check Fields &amp; Verification Details
                                  </Typography>
                                  <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                                    <Table size="small">
                                      <TableBody>
                                        {Object.entries(checkData)
                                          .filter(([k]) => !['id', 'case_id', 'created_at', 'updated_at', 'vendor_evidence', 'evidence', 'evidence_photos', 'statement_audio', 'statement_audio_url', 'statement', 'statement_mr', 'statement_en', 'statement_entries', 'vendor_documents', 'documents', 'assigned_vendor_name', 'questionnaire'].includes(k))
                                          .map(([key, val], idx) => {
                                            const displayVal = val === null || val === undefined || val === '' || val === '[]' || val === '{}'
                                              ? 'N/A'
                                              : Array.isArray(val)
                                                ? val.join(', ')
                                                : typeof val === 'object'
                                                  ? JSON.stringify(val)
                                                  : String(val);
                                            return (
                                              <TableRow key={key} sx={{ bgcolor: idx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                                <TableCell component="th" sx={{ width: '35%', fontWeight: 600, color: '#475569', textTransform: 'capitalize', borderRight: '1px solid #e2e8f0', py: 1.2 }}>
                                                  {key.replace(/_/g, ' ')}
                                                </TableCell>
                                                <TableCell sx={{ color: '#0f172a', fontWeight: 500, py: 1.2, wordBreak: 'break-word' }}>
                                                  {displayVal}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                      </TableBody>
                                    </Table>
                                  </Box>
                                </Paper>

                                {/* Dedicated Questionnaire Form Section */}
                                {(() => {
                                  const qData = parseQuestionnaire(checkData?.questionnaire);
                                  const hasData = qData && typeof qData === 'object' && Object.keys(qData).length > 0;
                                  const displayObj = hasData
                                    ? qData
                                    : Object.keys(QUESTIONNAIRE_LABELS).reduce((acc, k) => ({ ...acc, [k]: '—' }), {});

                                  return (
                                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 6px -1px rgba(0,0,0,0.05)' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                                          📋 Questionnaire Form Details
                                        </Typography>
                                        <Chip
                                          label={hasData ? "Vendor Submitted" : "Pending Submission"}
                                          size="small"
                                          sx={{
                                            bgcolor: hasData ? '#e0f2fe' : '#f1f5f9',
                                            color: hasData ? '#0369a1' : '#64748b',
                                            fontWeight: 700,
                                            fontSize: '11px',
                                            border: hasData ? '1px solid #bae6fd' : '1px solid #e2e8f0'
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                                        <Table size="small">
                                          <TableBody>
                                            {Object.entries(displayObj).map(([qKey, qVal], qIdx) => {
                                              const label = QUESTIONNAIRE_LABELS[qKey] || qKey.replace(/_/g, ' ');
                                              const valStr = qVal != null && qVal !== '' ? String(qVal) : '—';
                                              return (
                                                <TableRow key={qKey} sx={{ bgcolor: qIdx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                                  <TableCell component="th" sx={{ width: '35%', fontWeight: 600, color: '#475569', textTransform: 'capitalize', borderRight: '1px solid #e2e8f0', py: 1.2 }}>
                                                    {label}
                                                  </TableCell>
                                                  <TableCell sx={{ color: '#0f172a', fontWeight: 500, py: 1.2, wordBreak: 'break-word', whiteSpace: qKey === 'description_of_accident' ? 'pre-wrap' : 'normal' }}>
                                                    {valStr}
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </Box>
                                    </Paper>
                                  );
                                })()}

                                {/* Statements & Audio Recordings */}
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 6px -1px rgba(0,0,0,0.05)' }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563eb', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                                    🎙️ Statements &amp; Audio Recordings
                                  </Typography>
                                  {checkData.statement_entries && checkData.statement_entries.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {checkData.statement_entries.map((st, sIdx) => (
                                        <Paper key={sIdx} elevation={0} sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                                            Statement {st.index || sIdx + 1}
                                          </Typography>
                                          {st.audio_url && (
                                            <Box sx={{ mb: 1 }}>
                                              <audio controls src={st.audio_url} style={{ width: '100%', height: '36px' }} />
                                            </Box>
                                          )}
                                          <Typography variant="body2" sx={{ color: '#334155', whiteSpace: 'pre-line' }}>
                                            {st.translation_en || st.statement_text || 'No statement text.'}
                                          </Typography>
                                        </Paper>
                                      ))}
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                      No statement audio recordings stored.
                                    </Typography>
                                  )}

                                  {checkData.statement_en && (
                                    <Box sx={{ mt: 2 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                                        Additional Statement Details:
                                      </Typography>
                                      <Paper elevation={0} sx={{ p: 2, mt: 0.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <Typography variant="body2" sx={{ color: '#1e293b', whiteSpace: 'pre-line' }}>
                                          {checkData.statement_en}
                                        </Typography>
                                      </Paper>
                                    </Box>
                                  )}
                                </Paper>

                                {/* Visit Photos */}
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 6px -1px rgba(0,0,0,0.05)' }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563eb', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                                    📷 Visit Photos ({checkData.evidence_photos?.length || 0})
                                  </Typography>
                                  {checkData.evidence_photos && checkData.evidence_photos.length > 0 ? (
                                    <Box
                                      sx={{
                                        display: 'grid',
                                        gridTemplateColumns: {
                                          xs: 'repeat(2, 1fr)',
                                          sm: 'repeat(3, 1fr)',
                                          md: 'repeat(4, 1fr)',
                                        },
                                        gap: 2,
                                      }}
                                    >
                                      {checkData.evidence_photos.map((photo, pIdx) => (
                                        <Paper
                                          key={pIdx}
                                          elevation={0}
                                          onClick={() => setActivePhotoPreview(photo.url)}
                                          sx={{
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '10px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                            transition: 'all 0.2s',
                                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 14px rgba(0,0,0,0.1)' }
                                          }}
                                        >
                                          <Box
                                            component="img"
                                            src={photo.url}
                                            alt={photo.filename || `Visit Photo ${pIdx + 1}`}
                                            sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', bgcolor: '#f8fafc' }}
                                          />
                                          <Box sx={{ p: 1.25, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                                            <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, color: '#334155' }}>
                                              {photo.filename || `Photo ${pIdx + 1}`}
                                            </Typography>
                                            {(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date) && (
                                              <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5 }}>
                                                🕒 {new Date(photo.timestamp || photo.created_at || photo.uploaded_at || photo.date).toLocaleString()}
                                              </Typography>
                                            )}
                                            {(photo.location_name || photo.location || (photo.latitude != null && photo.longitude != null && photo.latitude !== '' && photo.longitude !== '')) && (
                                              <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                                📍 {photo.location_name || photo.location || `${Number(photo.latitude).toFixed(4)}, ${Number(photo.longitude).toFixed(4)}`}
                                              </Typography>
                                            )}
                                          </Box>
                                        </Paper>
                                      ))}
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                      No visit photos uploaded for this check.
                                    </Typography>
                                  )}
                                </Paper>

                                {/* Check Documents */}
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 6px -1px rgba(0,0,0,0.05)' }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563eb', mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                                    📄 Check Documents
                                  </Typography>
                                  {(() => {
                                    const cDocs = Array.isArray(checkData.case_documents) ? checkData.case_documents : (typeof checkData.case_documents === 'string' && checkData.case_documents !== '[]' && checkData.case_documents !== 'null' ? JSON.parse(checkData.case_documents) : []);
                                    const vDocs = Array.isArray(checkData.vendor_documents) ? checkData.vendor_documents : (typeof checkData.vendor_documents === 'string' && checkData.vendor_documents !== '[]' && checkData.vendor_documents !== 'null' ? JSON.parse(checkData.vendor_documents) : []);

                                    const cDocsArray = Array.isArray(cDocs) ? cDocs : [];
                                    const vDocsArray = Array.isArray(vDocs) ? vDocs : [];
                                    const allDocs = [...cDocsArray, ...vDocsArray];

                                    if (allDocs.length > 0) {
                                      return (
                                        <Box
                                          sx={{
                                            display: 'grid',
                                            gridTemplateColumns: {
                                              xs: '1fr',
                                              sm: 'repeat(2, 1fr)',
                                              md: 'repeat(3, 1fr)',
                                            },
                                            gap: 2,
                                          }}
                                        >
                                          {allDocs.map((doc, dIdx) => (
                                            <Box key={dIdx} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 1, transition: 'all 0.2s', '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' } }}>
                                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', wordBreak: 'break-all' }}>
                                                {doc.filename || `Document ${dIdx + 1}`}
                                              </Typography>
                                              <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => window.open(doc.url || doc.preview_url || doc.file_url, '_blank')}
                                                sx={{ mt: 'auto', textTransform: 'none', borderRadius: '6px' }}
                                              >
                                                View Document
                                              </Button>
                                            </Box>
                                          ))}
                                        </Box>
                                      );
                                    } else {
                                      return (
                                        <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                          No documents uploaded for this check.
                                        </Typography>
                                      );
                                    }
                                  })()}
                                </Paper>

                              </Box>
                            );
                          })()}
                        </>
                      ) : (
                        <Typography variant="body1" sx={{ color: '#94a3b8', textAlign: 'center', py: 4 }}>
                          No verification checks recorded for this case yet.
                        </Typography>
                      )}
                    </Box>
                  );
                })()}

                {/* TAB 2: Media & Evidence Gallery */}
                {fullCaseTab === 2 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                        📸 All Visit Photos Across Checks
                      </Typography>
                      {(() => {
                        const allPhotos = [];
                        fullCaseData.checks?.forEach(item => {
                          item.check?.evidence_photos?.forEach(photo => {
                            allPhotos.push({ ...photo, checkType: item.check_type_label });
                          });
                        });

                        if (allPhotos.length === 0) {
                          return (
                            <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                              No visit photos found across any checks.
                            </Typography>
                          );
                        }

                        return (
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: {
                                xs: 'repeat(2, 1fr)',
                                sm: 'repeat(3, 1fr)',
                                md: 'repeat(4, 1fr)',
                              },
                              gap: 2,
                            }}
                          >
                            {allPhotos.map((photo, i) => (
                              <Paper
                                key={i}
                                elevation={0}
                                onClick={() => setActivePhotoPreview(photo.url)}
                                sx={{
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                  transition: 'all 0.2s',
                                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 14px rgba(0,0,0,0.1)' }
                                }}
                              >
                                <Box
                                  component="img"
                                  src={photo.url}
                                  sx={{ width: '100%', height: 160, objectFit: 'cover', bgcolor: '#f8fafc' }}
                                />
                                <Box sx={{ p: 1.25, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                                  <Chip label={photo.checkType} size="small" sx={{ fontSize: '10px', height: '18px', mb: 0.5, bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 700 }} />
                                  <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600, color: '#334155' }}>
                                    {photo.filename || `Photo ${i + 1}`}
                                  </Typography>
                                  {(photo.timestamp || photo.created_at || photo.uploaded_at) && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5 }}>
                                      🕒 {new Date(photo.timestamp || photo.created_at || photo.uploaded_at).toLocaleString()}
                                    </Typography>
                                  )}
                                  {(photo.location_name || (photo.latitude != null && photo.longitude != null && photo.latitude !== '' && photo.longitude !== '')) && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#718096', fontSize: '10px', mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                      📍 {photo.location_name || `${Number(photo.latitude).toFixed(4)}, ${Number(photo.longitude).toFixed(4)}`}
                                    </Typography>
                                  )}
                                </Box>
                              </Paper>
                            ))}
                          </Box>
                        );
                      })()}
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setFullCaseModalOpen(false)} variant="outlined" sx={{ textTransform: 'none', borderRadius: '8px', px: 3, color: '#64748b', borderColor: '#cbd5e1' }}>
              Cancel
            </Button>
            {fullCaseData?.case?.full_case_status === 'Closed' ? (
              <Button
                onClick={() => {
                  setStatusConfirmAction('WIP');
                  setStatusConfirmOpen(true);
                }}
                variant="contained"
                disabled={statusLoading}
                sx={{ textTransform: 'none', bgcolor: '#48bb78', '&:hover': { bgcolor: '#38a169' }, borderRadius: '8px', px: 3 }}
              >
                {statusLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Open Case'}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setStatusConfirmAction('Closed');
                  setStatusConfirmOpen(true);
                }}
                variant="contained"
                disabled={statusLoading}
                sx={{ textTransform: 'none', bgcolor: '#e53e3e', '&:hover': { bgcolor: '#c53030' }, borderRadius: '8px', px: 3 }}
              >
                {statusLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Close Case'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Confirmation Dialog for Case Status Change */}
        <Dialog open={statusConfirmOpen} onClose={() => setStatusConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Status Change</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ color: '#475569' }}>
              Are you sure you want to {statusConfirmAction === 'Closed' ? 'close' : 'open'} this case?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => setStatusConfirmOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
            <Button
              onClick={() => {
                handleToggleCaseStatus(fullCaseData.case.id, statusConfirmAction);
                setStatusConfirmOpen(false);
              }}
              variant="contained"
              color={statusConfirmAction === 'Closed' ? 'error' : 'success'}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmation Dialog for Check Accept */}
        <Dialog open={confirmAcceptOpen} onClose={() => setConfirmAcceptOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Acceptance</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ color: '#475569' }}>
              Are you sure you want to accept this check?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => setConfirmAcceptOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
            <Button
              onClick={() => handleReviewSubmit('accept')}
              variant="contained"
              color="success"
              disabled={reviewLoading}
            >
              {reviewLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Confirm Accept'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmation Dialog for Check Reject */}
        <Dialog open={confirmRejectOpen} onClose={() => setConfirmRejectOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Confirm Rejection</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ color: '#475569' }}>
              Are you sure you want to reject and reassign this check?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => setConfirmRejectOpen(false)} variant="outlined" sx={{ color: '#64748b', borderColor: '#cbd5e1', '&:hover': { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' } }}>Cancel</Button>
            <Button
              onClick={() => handleReviewSubmit('reject')}
              variant="contained"
              color="error"
              disabled={reviewLoading}
            >
              {reviewLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Confirm Reject'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* File RTI Modal */}
        <Dialog open={rtiModalOpen} onClose={() => !rtiGenerating && setRtiModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Generate RTI Application</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: -1 }}>
                Please provide the following details to generate the RTI form. Other details (FIR No, Police Station, Victim Name, Vehicle No) will be automatically fetched from the database.
              </Typography>
              <TextField
                label='To (Public Information Officer Address)'
                fullWidth
                multiline
                rows={4}
                value={rtiFormData.toAddress}
                onChange={(e) => setRtiFormData({ ...rtiFormData, toAddress: e.target.value })}
                placeholder="The Public Information Officer under RTI Act,&#10;Tembhurni Police Station, Taluka Madha,&#10;District Solapur, Maharashtra – 413211"
                required
              />
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <DatePicker
                    label="Date of Accident *"
                    value={rtiFormData.accidentDate}
                    onChange={(newValue) => setRtiFormData({ ...rtiFormData, accidentDate: newValue })}
                    sx={{ flex: 1 }}
                  />
                  <TimePicker
                    label="Time of Accident *"
                    value={rtiFormData.accidentTime}
                    onChange={(newValue) => setRtiFormData({ ...rtiFormData, accidentTime: newValue })}
                    sx={{ flex: 1 }}
                    viewRenderers={{
                      hours: renderTimeViewClock,
                      minutes: renderTimeViewClock,
                      seconds: renderTimeViewClock,
                    }}
                  />
                </Box>
              </LocalizationProvider>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => setRtiModalOpen(false)} disabled={rtiGenerating} sx={{ color: '#64748b', fontWeight: 600 }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleGenerateRti}
              disabled={rtiGenerating || !rtiFormData.toAddress || !rtiFormData.accidentDate || !rtiFormData.accidentTime}
              sx={{ backgroundColor: '#667eea', color: 'white', fontWeight: 600, '&:hover': { backgroundColor: '#5a67d8' } }}
            >
              {rtiGenerating ? <CircularProgress size={20} color="inherit" /> : 'Generate & Download'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Section 134 Notice Modal */}
        <Dialog open={section134ModalOpen} onClose={() => !section134Generating && setSection134ModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Generate Section 134 Notice</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: -1 }}>
                Please provide the 'To' address to generate the Section 134 Notice. Other details (Policy No, Vehicle No, Claim No, Insurance Company) will be automatically fetched from the database.
              </Typography>
              <TextField
                label='To (Address)'
                fullWidth
                multiline
                rows={4}
                value={section134FormData.toAddress}
                onChange={(e) => setSection134FormData({ ...section134FormData, toAddress: e.target.value })}
                placeholder="Mr./Mrs. Jafar Rahim Shaikh&#10;Pension Pura, House No.&#10;8-162, Tal. Ambejogai, Beed"
                required
              />

              <Divider sx={{ my: 1 }} />
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155' }}>
                    Notice History (Sent: {section134HistoryLoading ? '...' : section134History.length} times)
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleUpdateSection134History}
                    disabled={section134HistoryUpdating || section134HistoryLoading}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {section134HistoryUpdating ? 'Updating...' : 'Mark as Sent'}
                  </Button>
                </Box>

                {section134HistoryLoading ? (
                  <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} />
                ) : section134History.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                    Notice has not been marked as sent yet.
                  </Typography>
                ) : (
                  <Box sx={{ maxHeight: 150, overflowY: 'auto', bgcolor: '#f8fafc', p: 2, borderRadius: 1, border: '1px solid #e2e8f0' }}>
                    {section134History.map((dateStr, idx) => (
                      <Typography key={idx} variant="body2" sx={{ color: '#475569', mb: 0.5 }}>
                        • Sent on: <strong>{new Date(dateStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => setSection134ModalOpen(false)} disabled={section134Generating} sx={{ color: '#64748b', fontWeight: 600 }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleGenerateSection134}
              disabled={section134Generating || !section134FormData.toAddress}
              sx={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 600, '&:hover': { backgroundColor: '#dc2626' } }}
            >
              {section134Generating ? <CircularProgress size={20} color="inherit" /> : 'Generate & Download'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Custom RTO Document Modal */}
        <Dialog
          open={rtoDocModalOpen}
          onClose={() => { setRtoDocModalOpen(false); setRtoDocData(null); }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ m: 0, p: 2, bgcolor: '#4527a0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Description sx={{ fontSize: 24 }} />
              <Box>
                <Typography variant="h6" fontWeight="700">
                  RTO Document Details
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {rtoDocData?.check?.rto_name ? `RTO: ${rtoDocData.check.rto_name}` : 'Regional Transport Office Verification'}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => { setRtoDocModalOpen(false); setRtoDocData(null); }} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers sx={{ p: 3, backgroundColor: '#f8fafc' }}>
            {rtoDocLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                <CircularProgress sx={{ color: '#4527a0' }} />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Generated Documents Preview */}
                {(() => {
                  const docs = rtoDocData?.check?.documents || [];
                  const generatedDocs = docs.filter(d => d.category === 'rto_document' || (d.filename && (d.filename.includes('DL_Extract') || d.filename.includes('RC_Particular') || d.filename.includes('Permit_Extract'))));
                  if (generatedDocs.length === 0) return null;

                  return (
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#f0fdf4' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📄 Previously Generated Documents
                      </Typography>
                      <Grid container spacing={2}>
                        {generatedDocs.map((doc, idx) => (
                          <Grid item xs={12} sm={4} key={idx}>
                            <Box sx={{ p: 1.5, borderRadius: '8px', border: '1px solid #bbf7d0', bgcolor: '#ffffff', display: 'flex', flexDirection: 'column', height: '100%' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', wordBreak: 'break-all', mb: 2 }}>
                                {doc.filename}
                              </Typography>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => window.open(doc.url || doc.preview_url || doc.file_url, '_blank')}
                                sx={{ mt: 'auto', textTransform: 'none', borderRadius: '6px', color: '#166534', borderColor: '#166534' }}
                              >
                                View Document
                              </Button>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Paper>
                  );
                })()}

                {/* Dropdown at Top */}
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4527a0', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Select Document Type
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={selectedRtoDocType}
                      onChange={(e) => setSelectedRtoDocType(e.target.value)}
                      sx={{
                        borderRadius: '8px',
                        fontWeight: 600,
                        color: '#1e293b',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' }
                      }}
                    >
                      <MenuItem value="DL Extract" sx={{ fontWeight: 600 }}>DL Extract</MenuItem>
                      <MenuItem value="RC Particular" sx={{ fontWeight: 600 }}>RC Particular</MenuItem>
                      <MenuItem value="Permit Extract" sx={{ fontWeight: 600 }}>Permit Extract</MenuItem>
                      <MenuItem value="All" sx={{ fontWeight: 700, color: '#4527a0' }}>All (All 3 Formats)</MenuItem>
                    </Select>
                  </FormControl>
                </Paper>

                {/* Editable Text Fields Section */}
                <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4527a0', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Document Information & Details
                  </Typography>
                  <Grid container spacing={2.5}>
                    {/* Row 1: Full-width multiline To Address */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="To (Address / Recipient)"
                        size="small"
                        multiline
                        rows={4}
                        value={rtoDocForm.to}
                        onChange={(e) => setRtoDocForm({ ...rtoDocForm, to: e.target.value })}
                        placeholder="Enter To address / recipient details"
                      />
                    </Grid>
                    {/* Row 2: Subject Name & ID Number */}
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Subject Name"
                        size="small"
                        value={rtoDocForm.subjectName}
                        onChange={(e) => setRtoDocForm({ ...rtoDocForm, subjectName: e.target.value })}
                        placeholder="Enter Subject Name"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="ID Number"
                        size="small"
                        value={rtoDocForm.idNumber}
                        onChange={(e) => setRtoDocForm({ ...rtoDocForm, idNumber: e.target.value })}
                        placeholder="Enter ID Number (e.g. DL / RC / Permit No)"
                      />
                    </Grid>
                    {/* Row 3: Authorized Signatory, Contact Number & Email ID */}
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Authorized Signatory"
                        size="small"
                        value={rtoDocForm.authorizedSignatory}
                        onChange={(e) => setRtoDocForm({ ...rtoDocForm, authorizedSignatory: e.target.value })}
                        placeholder="Enter Authorized Signatory Name"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Contact Number"
                        size="small"
                        value={rtoDocForm.contactNumber}
                        onChange={(e) => setRtoDocForm({ ...rtoDocForm, contactNumber: e.target.value })}
                        placeholder="Enter Contact Number"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Email ID"
                        size="small"
                        value={rtoDocForm.emailId}
                        onChange={(e) => setRtoDocForm({ ...rtoDocForm, emailId: e.target.value })}
                        placeholder="Enter Email ID"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              onClick={() => { setRtoDocModalOpen(false); setRtoDocData(null); }}
              disabled={rtoDocGenerating}
              sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateRtoDoc}
              variant="contained"
              disabled={rtoDocGenerating}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                backgroundColor: '#4527a0',
                color: '#fff',
                px: 3,
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#311b92' }
              }}
            >
              {rtoDocGenerating ? <CircularProgress size={20} color="inherit" /> : 'Generate & Download'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for Notifications */}
        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', fontWeight: 600 }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </CaseManagerLayout>
  );
};

export default CasesPage;
