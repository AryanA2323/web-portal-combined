import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Skeleton,
  Stack,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Card,
  CardMedia,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Save,
  Cancel,
  AssignmentInd,
  DirectionsCar,
  Person,
  LocationOn,
  Gavel,
  FolderOpen,
  CalendarToday,
  Speed,
  VerifiedUser,
  CheckCircleOutline,
  PinDrop,
  BadgeOutlined,
  ArticleOutlined,
  GavelOutlined,
  CloudUpload,
  Mic,
  Image as ImageIcon,
  Description as DocIcon,
  Close,
  OpenInNew,
  ZoomIn,
  InsertDriveFile,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from '../../components/case_manager';

// Helper to resolve media URLs to full backend origin so audio & images load properly
const resolveMediaUrl = (rawUrl) => {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;

  const path = rawUrl.startsWith('/media/')
    ? rawUrl
    : rawUrl.startsWith('media/')
      ? `/${rawUrl}`
      : `/media/${rawUrl.replace(/^\/+/, '')}`;

  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
  try {
    const origin = new URL(apiBase, window.location.origin).origin;
    return `${origin}${path}`;
  } catch {
    return `http://localhost:8000${path}`;
  }
};

// ─── AudioBlobPlayer: fetch audio as blob to guarantee playback ──────────────
// Browsers block cross-origin <audio> src loading silently.
// By fetching the file via JS (which respects CORS headers properly)
// and converting to a blob ObjectURL, we serve the audio from same-origin memory.
const AudioBlobPlayer = ({ rawUrl }) => {
  const audioRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rawUrl) return;
    let cancelled = false;
    let objectUrl = null;

    const fetchAudio = async () => {
      setLoading(true);
      setError(null);
      try {
        // Build a relative /media/... path so it goes through Vite proxy (same-origin)
        let fetchUrl = rawUrl;
        if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
          try {
            const u = new URL(fetchUrl);
            fetchUrl = u.pathname; // strip to just /media/...
          } catch { /* keep as-is */ }
        }
        if (!fetchUrl.startsWith('/')) fetchUrl = '/' + fetchUrl;
        if (!fetchUrl.startsWith('/media/') && !fetchUrl.startsWith('/api/')) {
          fetchUrl = '/media/' + fetchUrl.replace(/^\/+/, '');
        }

        const resp = await fetch(fetchUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAudio();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rawUrl]);

  if (!rawUrl) return null;

  if (loading) {
    return (
      <Box sx={{ my: 1, display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: '#f1f5f9', borderRadius: '8px' }}>
        <CircularProgress size={18} sx={{ color: '#6366f1' }} />
        <Typography sx={{ fontSize: '12.5px', color: '#64748b' }}>Loading audio…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ my: 1, p: 1.5, bgcolor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
        <Typography sx={{ fontSize: '12.5px', color: '#dc2626' }}>Failed to load audio: {error}</Typography>
      </Box>
    );
  }

  if (!blobUrl) return null;

  return (
    <Box sx={{ my: 1 }}>
      <audio
        ref={audioRef}
        controls
        preload="auto"
        src={blobUrl}
        style={{ width: '100%', height: '40px', borderRadius: '8px' }}
      />
    </Box>
  );
};

// ─── Theme tokens ────────────────────────────────────────────────────────────

const CHECK_META = {
  claimant: { label: 'Claimant Check', color: '#e53935', bg: '#fce4ec', gradient: 'linear-gradient(135deg,#f5576c 0%,#e53935 100%)', icon: <Person /> },
  insured: { label: 'Insured Check', color: '#1565c0', bg: '#e3f2fd', gradient: 'linear-gradient(135deg,#4facfe 0%,#1565c0 100%)', icon: <AssignmentInd /> },
  driver: { label: 'Driver Check', color: '#2e7d32', bg: '#e8f5e9', gradient: 'linear-gradient(135deg,#43e97b 0%,#2e7d32 100%)', icon: <DirectionsCar /> },
  spot: { label: 'Spot Check', color: '#e65100', bg: '#fff3e0', gradient: 'linear-gradient(135deg,#fa709a 0%,#e65100 100%)', icon: <LocationOn /> },
  chargesheet: { label: 'Chargesheet', color: '#6a1b9a', bg: '#f3e5f5', gradient: 'linear-gradient(135deg,#a18cd1 0%,#6a1b9a 100%)', icon: <Gavel /> },
  rti: { label: 'RTI Check', color: '#00695c', bg: '#e0f2f1', gradient: 'linear-gradient(135deg,#43e97b 0%,#00695c 100%)', icon: <ArticleOutlined /> },
  rto: { label: 'RTO Check', color: '#4527a0', bg: '#ede7f6', gradient: 'linear-gradient(135deg,#a18cd1 0%,#4527a0 100%)', icon: <DirectionsCar /> },
};

const STATUS_CFG = {
  Pending: { color: '#e65100', bg: '#fff3e0' },
  'In Progress': { color: '#1565c0', bg: '#e3f2fd' },
  Completed: { color: '#2e7d32', bg: '#e8f5e9' },
  Verified: { color: '#2e7d32', bg: '#e8f5e9' },
  Reassigned: { color: '#c62828', bg: '#ffebee' },
  Done: { color: '#2e7d32', bg: '#e8f5e9' },
  Open: { color: '#1565c0', bg: '#e3f2fd' },
  Closed: { color: '#37474f', bg: '#eceff1' },
  WIP: { color: '#1565c0', bg: '#e3f2fd' },
  Submitted: { color: '#6a1b9a', bg: '#f3e5f5' },
  Approved: { color: '#2e7d32', bg: '#e8f5e9' },
  Rejected: { color: '#c62828', bg: '#ffebee' },
  'Under Review': { color: '#e65100', bg: '#fff3e0' },
  Cancelled: { color: '#37474f', bg: '#eceff1' },
  'On Hold': { color: '#6a1b9a', bg: '#f3e5f5' },
  'Not Started': { color: '#78909c', bg: '#eceff1' },
};

const pill = (val) => {
  const cfg = STATUS_CFG[val] || { color: '#78909c', bg: '#eceff1' };
  return (
    <Chip
      label={val || '—'}
      size="small"
      sx={{ backgroundColor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '11px', height: '22px', borderRadius: '6px', letterSpacing: '0.2px' }}
    />
  );
};

const fmtDateDisplay = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).slice(0, 19));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const LONG_FIELDS = new Set(['statement', 'accident_brief', 'special_instructions', 'remarks', 'triggers']);

// ─── Field definitions (OBSERVATIONS REMOVED) ─────────────────────────────

const CASE_FIELDS_DEF = [
  { name: 'claim_number', label: 'Claim Number' },
  { name: 'client_name', label: 'Client Name' },
  { name: 'category', label: 'Category', options: ['MACT', 'GPA', 'PA', 'Health', 'Fire', 'Marine', 'Misc'] },
  { name: 'case_type', label: 'Case Type', options: ['Full Case', 'Partial', 'Reinvestigation'] },
  { name: 'case_receive_date', label: 'Receive Date', type: 'date' },
  { name: 'case_due_date', label: 'Due Date', type: 'date' },
  { name: 'completion_date', label: 'Completion Date', type: 'date' },
  { name: 'sla', label: 'SLA', options: ['AT', 'WT'] },
  { name: 'investigation_report_status', label: 'IR Status', options: ['Open', 'Submitted', 'Approved', 'Rejected', 'Under Review', 'Closed'] },
  { name: 'full_case_status', label: 'Case Status', options: ['WIP', 'Completed', 'Pending', 'On Hold', 'Cancelled'] },
  { name: 'special_instructions', label: 'Special Instructions' },
];

const CHECK_FIELDS_DEF = {
  claimant: [
    { name: 'claimant_name', label: 'Claimant Name' },
    { name: 'claimant_contact', label: 'Contact' },
    { name: 'claimant_address', label: 'Address' },
    { name: 'claimant_income', label: 'Income (₹)', type: 'number' },
    { name: 'check_status', label: 'Check Status', options: ['Pending', 'WIP', 'Completed', 'Verified', 'Reassigned'] },
    { name: 'statement', label: 'Statement' },
    { name: 'triggers', label: 'Triggers' },
  ],
  insured: [
    { name: 'insured_name', label: 'Insured Name' },
    { name: 'insured_contact', label: 'Contact' },
    { name: 'insured_address', label: 'Address' },
    { name: 'policy_number', label: 'Policy Number' },
    { name: 'policy_period', label: 'Policy Period' },
    { name: 'rc', label: 'RC' },
    { name: 'permit', label: 'Permit' },
    { name: 'driver_and_insured_same', label: 'Insured Same as Driver', type: 'boolean' },
    { name: 'insured_cum_driver', label: 'Insured Same as Driver', type: 'boolean' },
    { name: 'check_status', label: 'Check Status', options: ['Pending', 'WIP', 'Completed', 'Verified', 'Reassigned'] },
    { name: 'statement', label: 'Statement' },
    { name: 'triggers', label: 'Triggers' },
  ],
  driver: [
    { name: 'driver_name', label: 'Driver Name' },
    { name: 'driver_contact', label: 'Contact' },
    { name: 'driver_address', label: 'Address' },
    { name: 'dl', label: 'Driving Licence (DL)' },
    { name: 'permit', label: 'Permit' },
    { name: 'occupation', label: 'Occupation' },
    { name: 'driver_and_insured_same', label: 'Driver Same as Insured', type: 'boolean' },
    { name: 'insured_cum_driver', label: 'Insured Same as Driver', type: 'boolean' },
    { name: 'check_status', label: 'Check Status', options: ['Pending', 'WIP', 'Completed', 'Verified', 'Reassigned'] },
    { name: 'statement', label: 'Statement' },
    { name: 'triggers', label: 'Triggers' },
  ],
  spot: [
    { name: 'time_of_accident', label: 'Time of Accident' },
    { name: 'place_of_accident', label: 'Place of Accident' },
    { name: 'district', label: 'District' },
    { name: 'city', label: 'City' },
    { name: 'police_station', label: 'Police Station' },
    { name: 'fir_number', label: 'FIR Number' },
    { name: 'check_status', label: 'Check Status', options: ['Pending', 'WIP', 'Completed', 'Verified', 'Reassigned'] },
    { name: 'accident_brief', label: 'Accident Brief' },
    { name: 'triggers', label: 'Triggers' },
  ],
  chargesheet: [
    { name: 'fir_number', label: 'FIR Number' },
    { name: 'city', label: 'City' },
    { name: 'court_name', label: 'Court Name' },
    { name: 'mv_act', label: 'MV Act' },
    { name: 'police_station_name', label: 'Police Station Name' },
    { name: 'court_district', label: 'Court District' },
    { name: 'court_case_no', label: 'Court Case No' },
    { name: 'fir_delay_days', label: 'FIR Delay Days', type: 'number' },
    { name: 'bsn_section', label: 'BSN Section' },
    { name: 'ipc', label: 'IPC' },
    { name: 'check_status', label: 'Check Status', options: ['Pending', 'WIP', 'Completed', 'Verified', 'Reassigned'] },
    { name: 'statement', label: 'Statement' },
    { name: 'triggers', label: 'Triggers' },
  ],
  rti: [
    { name: 'chargesheet_checked', label: 'Chargesheet / FIR', type: 'boolean' },
    { name: 'fir_number', label: 'FIR Number' },
    { name: 'dl_checked', label: 'Driving Licence', type: 'boolean' },
    { name: 'dl_number', label: 'DL Number' },
    { name: 'permit_checked', label: 'Permit', type: 'boolean' },
    { name: 'permit_number', label: 'Permit Number' },
    { name: 'rc_checked', label: 'RC', type: 'boolean' },
    { name: 'rc_number', label: 'RC Number' },
    { name: 'check_status', label: 'Check Status', options: ['Pending', 'WIP', 'Completed', 'Verified', 'Reassigned'] },
    { name: 'remarks', label: 'Remarks' },
  ],
  rto: [
    { name: 'rto_name', label: 'RTO Name' },
    { name: 'rto_address', label: 'RTO Address' },
    { name: 'dl_checked', label: 'Driving Licence', type: 'boolean' },
    { name: 'dl_number', label: 'DL Number' },
    { name: 'permit_checked', label: 'Permit', type: 'boolean' },
    { name: 'permit_number', label: 'Permit Number' },
    { name: 'rc_checked', label: 'RC', type: 'boolean' },
    { name: 'rc_number', label: 'RC Number' },
    { name: 'check_status', label: 'Check Status', options: ['Pending', 'WIP', 'Completed', 'Verified', 'Reassigned'] },
    { name: 'remarks', label: 'Remarks' },
  ],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatBadge = ({ icon, label, value, color = '#667eea' }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1,
    px: 2, py: 1.2,
    background: '#fff',
    border: `1px solid ${color}25`,
    borderLeft: `3px solid ${color}`,
    borderRadius: '8px',
    minWidth: 0,
  }}>
    <Box sx={{ color, flexShrink: 0 }}>{icon}</Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Typography>
      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</Typography>
    </Box>
  </Box>
);

// Tabular View Component (matching Review Modal table format)
const TabularFieldsView = ({ fields, getVal }) => {
  return (
    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', bgcolor: '#fff' }}>
      <Table size="small" sx={{ width: '100%' }}>
        <TableBody>
          {fields.map((fd, idx) => {
            const rawVal = getVal(fd.name);
            const isStatus = fd.name === 'check_status' || fd.name === 'full_case_status' || fd.name === 'investigation_report_status' || fd.name === 'sla';
            const isDate = fd.type === 'date';

            let displayVal = '—';
            if (fd.type === 'boolean') {
              displayVal = (rawVal === true || rawVal === 'true') ? 'Yes' : 'No';
            } else if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
              displayVal = isDate ? fmtDateDisplay(rawVal) : String(rawVal);
            }

            return (
              <TableRow key={fd.name} sx={{ bgcolor: idx % 2 === 0 ? '#f7fafc' : '#ffffff' }}>
                <TableCell component="th" scope="row" sx={{ width: '38%', color: '#4a5568', fontWeight: 600, fontSize: '13px', borderRight: '1px solid #edf2f7', py: 1.2 }}>
                  {fd.label}
                </TableCell>
                <TableCell sx={{ color: '#1a202c', fontWeight: isStatus ? 700 : 500, fontSize: '13px', py: 1.2, wordBreak: 'break-word' }}>
                  {isStatus ? pill(rawVal) : displayVal}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

// Edit Form Grid Component (for Edit Mode)
const EditFormGrid = ({ fields, getVal, onChange }) => {
  return (
    <Grid container spacing={2}>
      {fields.map((fd) => {
        const val = getVal(fd.name) ?? '';
        const isLong = LONG_FIELDS.has(fd.name);

        if (fd.options) {
          return (
            <Grid size={{ xs: 12, sm: 6 }} key={fd.name}>
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel sx={{ fontSize: '13px' }}>{fd.label}</InputLabel>
                <Select value={val} label={fd.label} onChange={(e) => onChange(fd.name, e.target.value)} sx={{ fontSize: '13px', borderRadius: '8px' }}>
                  {fd.options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: '13px' }}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          );
        }

        if (fd.type === 'boolean') {
          return (
            <Grid size={{ xs: 12, sm: 6 }} key={fd.name}>
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel sx={{ fontSize: '13px' }}>{fd.label}</InputLabel>
                <Select
                  value={val === true || val === 'true' ? 'true' : 'false'}
                  label={fd.label}
                  onChange={(e) => onChange(fd.name, e.target.value === 'true')}
                  sx={{ fontSize: '13px', borderRadius: '8px' }}
                >
                  <MenuItem value="true" sx={{ fontSize: '13px' }}>Yes</MenuItem>
                  <MenuItem value="false" sx={{ fontSize: '13px' }}>No</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          );
        }

        return (
          <Grid size={{ xs: 12, sm: isLong ? 12 : 6 }} key={fd.name}>
            <TextField
              fullWidth
              size="small"
              label={fd.label}
              type={fd.type || 'text'}
              value={val}
              onChange={(e) => onChange(fd.name, e.target.value)}
              multiline={isLong}
              minRows={isLong ? 3 : undefined}
              sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' }, '& .MuiInputBase-input': { fontSize: '13px' } }}
              InputLabelProps={fd.type === 'date' ? { shrink: true } : undefined}
            />
          </Grid>
        );
      })}
    </Grid>
  );
};

const LoadingSkeleton = () => (
  <Box>
    <Skeleton variant="rounded" height={80} sx={{ mb: 2.5, borderRadius: '12px' }} />
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={460} sx={{ borderRadius: '14px' }} /></Grid>
      <Grid size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={460} sx={{ borderRadius: '14px' }} /></Grid>
    </Grid>
  </Box>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const CheckDetailPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin' || user?.sub_role === 'super_admin';
  const { caseId, checkType } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);

  const [caseData, setCaseData] = useState({});
  const [checkData, setCheckData] = useState({});
  const [caseDraft, setCaseDraft] = useState({});
  const [checkDraft, setCheckDraft] = useState({});
  const [tatRequest, setTatRequest] = useState(null);

  // TAT Change Modal state
  const [tatChangeOpen, setTatChangeOpen] = useState(false);
  const [updatedTatDays, setUpdatedTatDays] = useState('');
  const [tatReason, setTatReason] = useState('');
  const [tatSubmitting, setTatSubmitting] = useState(false);

  // Media preview & upload states
  const [activeMediaTab, setActiveMediaTab] = useState(0);
  const [activePhoto, setActivePhoto] = useState(null);

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('evidence');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatementText, setUploadStatementText] = useState('');
  const [uploading, setUploading] = useState(false);

  const meta = CHECK_META[checkType] || { label: checkType, color: '#667eea', bg: '#f0f0ff', gradient: 'linear-gradient(135deg,#667eea,#764ba2)', icon: <FolderOpen /> };

  const fetchDetail = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/cases/incident-db/${caseId}/check/${checkType}`);
      setCaseData(res.data.case || {});
      setCheckData(res.data.check || {});

      // Fetch TAT Change Request
      try {
        const tatRes = await api.get(`/cases/${caseId}/approval/`);
        if (tatRes.data.has_request) {
          setTatRequest(tatRes.data.request);
        } else {
          setTatRequest(null);
        }
      } catch (tatErr) {
        console.error("Failed to load TAT request status", tatErr);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load details.');
    } finally { setLoading(false); }
  }, [caseId, checkType]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleStartEdit = () => { setCaseDraft({ ...caseData }); setCheckDraft({ ...checkData }); setEditing(true); setSuccess(''); setError(''); };
  const handleCancelEdit = () => { setEditing(false); setCaseDraft({}); setCheckDraft({}); setSuccess(''); setError(''); };
  const handleCaseChange = (n, v) => setCaseDraft((p) => ({ ...p, [n]: v }));
  const handleCheckChange = (n, v) => setCheckDraft((p) => ({ ...p, [n]: v }));

  const handleTatChangeSubmit = async () => {
    if (!updatedTatDays || !tatReason) return;
    setTatSubmitting(true);
    try {
      await api.post(`/cases/${caseId}/approval/`, {
        updated_tat_days: parseInt(updatedTatDays, 10),
        reason: tatReason,
      });
      setSuccess('TAT Change Request submitted successfully.');
      setTatChangeOpen(false);
      setUpdatedTatDays('');
      setTatReason('');
      await fetchDetail(); // Refresh to get the new request status
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit TAT change request.');
    } finally {
      setTatSubmitting(false);
    }
  };


  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put(`/cases/incident-db/${caseId}/check/${checkType}`, { case: caseDraft, check: checkDraft });
      setSuccess('Changes saved successfully.');
      setEditing(false);
      await fetchDetail();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleOpenUpload = (cat = 'evidence') => {
    setUploadCategory(cat);
    setUploadFile(null);
    setUploadStatementText('');
    setUploadOpen(true);
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('category', uploadCategory);
      if (uploadCategory === 'statement' && uploadStatementText) {
        formData.append('statement_text', uploadStatementText);
      }

      await api.post(`/cases/incident-db/${caseId}/check/${checkType}/upload-media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(`${uploadCategory.toUpperCase()} uploaded successfully!`);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadStatementText('');
      await fetchDetail();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || err.message || 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const caseVal = (n) => (editing ? caseDraft[n] ?? '' : caseData[n] ?? '');
  const checkVal = (n) => (editing ? checkDraft[n] ?? '' : checkData[n] ?? '');

  const irCfg = STATUS_CFG[caseData.investigation_report_status] || { color: '#78909c', bg: '#eceff1' };
  const staCfg = STATUS_CFG[caseData.full_case_status] || { color: '#78909c', bg: '#eceff1' };
  const checkFieldsDef = CHECK_FIELDS_DEF[checkType] || [];
  const latKey = checkType === 'spot' ? 'spot_lat' : `${checkType}_lat`;
  const lngKey = checkType === 'spot' ? 'spot_lng' : `${checkType}_lng`;

  // Media data normalized
  const evidencePhotos = checkData.evidence_photos || [];
  const documents = checkData.documents || [];

  // Combine audio recordings from statement_entries + main statement_audio_url if missing
  let statementEntries = checkData.statement_entries || [];
  if (statementEntries.length === 0 && (checkData.statement_audio_url || checkData.statement_audio_path)) {
    const rawAudioPath = checkData.statement_audio_url || checkData.statement_audio_path;
    statementEntries = [{
      url: rawAudioPath,
      audio_url: rawAudioPath,
      filename: 'Vendor Statement Recording',
      statement_text: checkData.statement || '',
      created_at: checkData.updated_at,
    }];
  }

  return (
    <CaseManagerLayout>
      <Box sx={{ minHeight: '100vh', backgroundColor: '#f4f6fb' }}>

        {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
        <Box sx={{
          background: meta.gradient,
          pt: { xs: 2, md: 2.5 },
          pb: { xs: 2.5, md: 3 },
          px: { xs: 2, md: 4 },
          position: 'relative',
          overflow: 'hidden',
        }}>
          <Box sx={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -60, left: '30%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

          {/* Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, opacity: 0.85 }}>
              <IconButton onClick={() => navigate('/case_manager/cases')} size="small" sx={{ color: '#fff', p: 0.5, '&:hover': { background: 'rgba(255,255,255,0.15)' } }}>
                <ArrowBack sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', '&:hover': { color: '#fff' } }} onClick={() => navigate('/case_manager/cases')}>
                Cases
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>›</Typography>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                {caseData.claim_number || `Case #${caseId}`}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>›</Typography>
              <Typography sx={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{meta.label}</Typography>
            </Box>
            <NotificationBell iconColor="#fff" />
          </Box>

          {/* Title row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 52, height: 52, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 26 }}>
                {meta.icon}
              </Avatar>
              <Box>
                <Typography sx={{ fontSize: { xs: '20px', md: '26px' }, fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                  {meta.label}
                </Typography>
                <Typography sx={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.75)', mt: 0.4 }}>
                  {caseData.client_name || '—'}&nbsp;&nbsp;·&nbsp;&nbsp;Claim&nbsp;
                  <strong style={{ color: '#fff' }}>{caseData.claim_number || `#${caseId}`}</strong>
                </Typography>
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {!loading && !editing && isSuperAdmin && (
                <Button
                  variant="contained"
                  startIcon={<Edit sx={{ fontSize: 16 }} />}
                  onClick={handleStartEdit}
                  sx={{
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    borderRadius: '10px',
                    px: 2.5,
                    '&:hover': { background: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  Edit record
                </Button>
              )}
              {editing && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<Cancel sx={{ fontSize: 16 }} />}
                    onClick={handleCancelEdit}
                    disabled={saving}
                    sx={{ border: '1px solid rgba(255,255,255,0.5)', color: '#fff', textTransform: 'none', fontWeight: 600, fontSize: '13px', borderRadius: '10px', px: 2, '&:hover': { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.7)' } }}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save sx={{ fontSize: 16 }} />}
                    onClick={handleSave}
                    disabled={saving}
                    sx={{ background: '#fff', color: meta.color, fontWeight: 700, fontSize: '13px', textTransform: 'none', borderRadius: '10px', px: 2.5, '&:hover': { background: 'rgba(255,255,255,0.9)' } }}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Box>

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 2, md: 4 }, mt: 2, pb: 5, maxWidth: 1400, mx: 'auto' }}>

          {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2, borderRadius: '10px' }}>{success}</Alert>}

          {/* ── Stat strip ── */}
          {!loading && (
            <Paper elevation={0} sx={{
              borderRadius: '14px', p: 2, mb: 3,
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 1.5,
              bgcolor: '#fff',
            }}>
              <StatBadge icon={<FolderOpen sx={{ fontSize: 18 }} />} label="Claim Number" value={caseData.claim_number} color="#667eea" />
              <StatBadge icon={<CalendarToday sx={{ fontSize: 18 }} />} label="Receive Date" value={fmtDateDisplay(caseData.case_receive_date)} color="#06b6d4" />
              <StatBadge icon={<Speed sx={{ fontSize: 18 }} />} label="TAT Days" value={caseData.tat_days != null ? `${caseData.tat_days} days` : null} color="#f59e0b" />
              <StatBadge icon={<CheckCircleOutline sx={{ fontSize: 18 }} />} label="IR Status" value={caseData.investigation_report_status} color={irCfg.color} />
              <StatBadge icon={<VerifiedUser sx={{ fontSize: 18 }} />} label="Case Status" value={caseData.full_case_status} color={staCfg.color} />
              <StatBadge icon={<PinDrop sx={{ fontSize: 18 }} />} label="Check Status" value={checkData.check_status} color={meta.color} />
            </Paper>
          )}

          {loading ? <LoadingSkeleton /> : (
            <Stack spacing={3}>

              {/* ── TABULAR SECTIONS (CASE + CHECK DETAILS SIDE-BY-SIDE) ────── */}
              <Grid container spacing={3} alignItems="stretch">

                {/* ── LEFT: Case Information (Tabular) ────────────────────── */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', height: '100%', bgcolor: '#fff', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: 1.2, bgcolor: '#f8fafc' }}>
                      <Box sx={{ width: 4, height: 24, borderRadius: '2px', background: 'linear-gradient(135deg,#667eea,#764ba2)' }} />
                      <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Case Information
                      </Typography>
                      {editing && (
                        <Chip label="Editing" size="small" sx={{ ml: 'auto', background: '#eef2ff', color: '#667eea', fontWeight: 700, fontSize: '10px', height: '20px' }} />
                      )}
                    </Box>
                    <Box sx={{ p: 2.5, flex: 1 }}>
                      {editing ? (
                        <EditFormGrid fields={CASE_FIELDS_DEF} getVal={caseVal} onChange={handleCaseChange} />
                      ) : (
                        <TabularFieldsView fields={CASE_FIELDS_DEF} getVal={caseVal} />
                      )}
                      
                      {/* TAT Days Change Management Sub-section */}
                      <Box sx={{ mt: 3, pt: 3, borderTop: '1px dashed #cbd5e1' }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 2 }}>
                          Change Management - TAT Days
                        </Typography>
                        <Grid container spacing={2} alignItems="center">
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="TAT Days"
                              value={caseData.tat_days !== null ? caseData.tat_days : ''}
                              InputProps={{ readOnly: true }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f5f5f5' }, '& .MuiInputBase-input': { fontSize: '13px' } }}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Button 
                              variant="outlined" 
                              size="small" 
                              onClick={() => setTatChangeOpen(true)}
                              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                            >
                              Request Change
                            </Button>
                          </Grid>
                        </Grid>
                        
                        {/* Request Status Display */}
                        {tatRequest && (
                          <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', bgcolor: tatRequest.status === 'REJECTED' ? '#fef2f2' : '#eff6ff', border: '1px solid', borderColor: tatRequest.status === 'REJECTED' ? '#fecaca' : '#bfdbfe' }}>
                            <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: tatRequest.status === 'REJECTED' ? '#dc2626' : '#2563eb' }}>
                              Status: {tatRequest.status === 'PENDING' ? 'Pending Super Admin Approval' : tatRequest.status === 'REJECTED' ? 'Rejected' : tatRequest.status}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#475569', mt: 0.5 }}>
                              Requested TAT: {tatRequest.updated_tat_days} days
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                {/* ── RIGHT: Check Details (Tabular) ───────────────────────── */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper elevation={0} sx={{ borderRadius: '14px', border: `1px solid ${meta.color}35`, overflow: 'hidden', height: '100%', bgcolor: '#fff', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: 1.2, bgcolor: meta.bg }}>
                      <Avatar sx={{ width: 28, height: 28, background: meta.color, color: '#fff', fontSize: '15px' }}>
                        {meta.icon}
                      </Avatar>
                      <Typography sx={{ fontSize: '14px', fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {meta.label} Details
                      </Typography>
                      {checkData.check_status && <Box sx={{ ml: 'auto' }}>{pill(checkData.check_status)}</Box>}
                    </Box>
                    <Box sx={{ p: 2.5, flex: 1 }}>
                      {editing ? (
                        <EditFormGrid fields={checkFieldsDef} getVal={checkVal} onChange={handleCheckChange} />
                      ) : (
                        <TabularFieldsView fields={checkFieldsDef} getVal={checkVal} />
                      )}
                    </Box>
                  </Paper>
                </Grid>

              </Grid>

              {/* Geocoordinates Bar (If available) */}
              {['claimant', 'insured', 'driver', 'spot', 'rto'].includes(checkType) && (
                <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', bgcolor: '#fff' }}>
                  <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc' }}>
                    <PinDrop sx={{ fontSize: 18, color: '#06b6d4' }} />
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Geocoordinates & Location</Typography>
                    <Chip label="Auto-filled" size="small" sx={{ ml: 1, background: '#e0f7fa', color: '#00838f', fontWeight: 700, fontSize: '10px', height: '18px' }} />
                  </Box>
                  <Box sx={{ px: 2.5, py: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      {[{ key: latKey, label: 'Latitude' }, { key: lngKey, label: 'Longitude' }].map((c) => {
                        const raw = checkData[c.key];
                        return (
                          <Grid size={{ xs: 12, sm: 5 }} key={c.key}>
                            <Box sx={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <PinDrop sx={{ fontSize: 18, color: '#06b6d4', flexShrink: 0 }} />
                              <Box>
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</Typography>
                                <Typography sx={{ fontSize: '13px', fontFamily: 'monospace', color: raw != null ? '#0f172a' : '#94a3b8', fontWeight: 600 }}>
                                  {raw != null ? Number(raw).toFixed(6) : 'pending geocoding…'}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        );
                      })}
                      {checkData[latKey] != null && checkData[lngKey] != null && (
                        <Grid size={{ xs: 12, sm: 2 }}>
                          <Button
                            fullWidth
                            size="medium"
                            variant="outlined"
                            startIcon={<LocationOn sx={{ fontSize: 16 }} />}
                            href={`https://maps.google.com/?q=${checkData[latKey]},${checkData[lngKey]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 700, color: '#06b6d4', borderColor: '#06b6d4', borderRadius: '8px', py: 1 }}
                          >
                            Google Maps
                          </Button>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                </Paper>
              )}

              {/* ─── VENDOR FEEDBACK & NEGATIVE STATUS ────────────────────────── */}
              {(checkData.negative_status || checkData.vendor_feedback) && (
                <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid #fecaca', overflow: 'hidden', bgcolor: '#fff5f5', mb: 3 }}>
                  <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fef2f2' }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚠️ Vendor Feedback</Typography>
                    {checkData.negative_status && (
                      <Chip label={checkData.negative_status} size="small" sx={{ ml: 1, background: '#fee2e2', color: '#991b1b', fontWeight: 800, border: '1px solid #fca5a5' }} />
                    )}
                  </Box>
                  <Box sx={{ px: 2.5, py: 2 }}>
                    <Typography sx={{ fontSize: '14px', color: '#7f1d1d', whiteSpace: 'pre-wrap' }}>
                      {checkData.vendor_feedback || 'No additional feedback provided.'}
                    </Typography>
                  </Box>
                </Paper>
              )}

              {/* ─── UPLOADS, EVIDENCE & STATEMENT RECORDINGS SECTION ─────────── */}
              <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>

                {/* Header */}
                <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Avatar sx={{ width: 36, height: 36, background: '#eef2ff', color: '#4f46e5', fontSize: '20px' }}>
                      <CloudUpload sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
                        Uploads, Evidence & Audio Recordings
                      </Typography>
                      <Typography sx={{ fontSize: '11.5px', color: '#64748b' }}>
                        View vendor uploads or attach new documents, visit photos, and audio files
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CloudUpload sx={{ fontSize: 16 }} />}
                    onClick={() => handleOpenUpload(activeMediaTab === 0 ? 'evidence' : activeMediaTab === 1 ? 'statement' : 'document')}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: 'linear-gradient(135deg,#4f46e5,#3730a3)',
                      boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
                      '&:hover': { background: 'linear-gradient(135deg,#4338ca,#312e81)' },
                    }}
                  >
                    Upload {activeMediaTab === 0 ? 'Visit Photo' : activeMediaTab === 1 ? 'Audio Recording' : 'Document'}
                  </Button>
                </Box>

                {/* Navigation Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, bgcolor: '#f8fafc' }}>
                  <Tabs
                    value={activeMediaTab}
                    onChange={(e, val) => setActiveMediaTab(val)}
                    sx={{
                      minHeight: '44px',
                      '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '13px', minHeight: '44px', px: 2 },
                    }}
                  >
                    <Tab icon={<ImageIcon sx={{ fontSize: 17 }} />} iconPosition="start" label={`Visit Photos (${evidencePhotos.length})`} />
                    <Tab icon={<Mic sx={{ fontSize: 17 }} />} iconPosition="start" label={`Audio Recordings (${statementEntries.length})`} />
                    <Tab icon={<DocIcon sx={{ fontSize: 17 }} />} iconPosition="start" label={`Documents (${documents.length})`} />
                  </Tabs>
                </Box>

                {/* Tab 0: VISIT PHOTOS */}
                {activeMediaTab === 0 && (
                  <Box sx={{ p: 3 }}>
                    {evidencePhotos.length === 0 ? (
                      <Box sx={{ py: 5, textAlign: 'center', color: '#94a3b8', bgcolor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <ImageIcon sx={{ fontSize: 42, opacity: 0.6, mb: 1, color: '#64748b' }} />
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>No Visit Photos Uploaded</Typography>
                        <Typography sx={{ fontSize: '12px', color: '#64748b', mb: 2 }}>Upload vendor visit photos for this check.</Typography>
                        <Button size="small" variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 15 }} />} onClick={() => handleOpenUpload('evidence')} sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}>
                          Upload Visit Photo
                        </Button>
                      </Box>
                    ) : (
                      <Grid container spacing={2}>
                        {evidencePhotos.map((photo, idx) => {
                          const rawPhotoUrl = photo.url || photo.preview_url || photo.photo_url;
                          const photoUrl = resolveMediaUrl(rawPhotoUrl);
                          return (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={`photo-${idx}`}>
                              <Card elevation={0} sx={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative', '&:hover .overlay': { opacity: 1 } }}>
                                <Box sx={{ position: 'relative', height: 160, bgcolor: '#0f172a' }}>
                                  <CardMedia component="img" height="160" image={photoUrl} alt={photo.filename || `Evidence ${idx + 1}`} sx={{ objectFit: 'cover' }} />
                                  <Box className="overlay" onClick={() => setActivePhoto(photoUrl)} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(15,23,42,0.5)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <ZoomIn sx={{ color: '#fff', fontSize: 32 }} />
                                  </Box>
                                </Box>
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={photo.filename || `Evidence ${idx + 1}`}>
                                    {photo.filename || `Evidence_${idx + 1}.jpg`}
                                  </Typography>
                                  <Box sx={{ mt: 1 }}>
                                    <Typography sx={{ fontSize: '10.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      🕒 {fmtDateDisplay(photo.uploaded_at || photo.captured_at || photo.timestamp)}
                                    </Typography>
                                    {(photo.location_name || (photo.latitude != null && photo.longitude != null)) && (
                                      <Typography sx={{ fontSize: '10.5px', color: '#64748b', mt: 0.5, display: 'flex', alignItems: 'flex-start', gap: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                        📍 {photo.location_name || `${Number(photo.latitude).toFixed(4)}, ${Number(photo.longitude).toFixed(4)}`}
                                      </Typography>
                                    )}
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}
                  </Box>
                )}

                {/* Tab 1: AUDIO RECORDINGS */}
                {activeMediaTab === 1 && (
                  <Box sx={{ p: 3 }}>
                    {statementEntries.length === 0 ? (
                      <Box sx={{ py: 5, textAlign: 'center', color: '#94a3b8', bgcolor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <Mic sx={{ fontSize: 42, opacity: 0.6, mb: 1, color: '#64748b' }} />
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>No Statement Audio Recordings</Typography>
                        <Typography sx={{ fontSize: '12px', color: '#64748b', mb: 2 }}>Upload statement recordings for this check.</Typography>
                        <Button size="small" variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 15 }} />} onClick={() => handleOpenUpload('statement')} sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}>
                          Upload Audio Recording
                        </Button>
                      </Box>
                    ) : (
                      <Stack spacing={2}>
                        {statementEntries.map((rec, idx) => {
                          const rawAudioUrl = rec.url || rec.audio_url || rec.statement_audio_path || rec.audio_path || checkData.statement_audio_url || checkData.statement_audio_path;
                          return (
                            <Paper key={`rec-${idx}`} elevation={0} sx={{ p: 2, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                <Avatar sx={{ width: 34, height: 34, bgcolor: '#e0e7ff', color: '#4338ca' }}>
                                  <Mic sx={{ fontSize: 18 }} />
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                    {rec.filename || `Statement Recording #${idx + 1}`}
                                  </Typography>
                                  <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                    Recorded: {fmtDateDisplay(rec.created_at || rec.timestamp || rec.uploaded_at)}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Audio Player — fetched as blob to avoid cross-origin issues */}
                              <AudioBlobPlayer rawUrl={rawAudioUrl} />

                              {/* Transcript / Statement Text */}
                              {(rec.transcript_en || rec.statement_text) && (
                                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                  <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                                    Statement Text / Transcript (English)
                                  </Typography>
                                  <Typography sx={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
                                    {rec.transcript_en || rec.statement_text}
                                  </Typography>
                                </Box>
                              )}
                            </Paper>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>
                )}

                {/* Tab 2: DOCUMENTS */}
                {activeMediaTab === 2 && (
                  <Box sx={{ p: 3 }}>
                    {documents.length === 0 ? (
                      <Box sx={{ py: 5, textAlign: 'center', color: '#94a3b8', bgcolor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <DocIcon sx={{ fontSize: 42, opacity: 0.6, mb: 1, color: '#64748b' }} />
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>No Documents Uploaded</Typography>
                        <Typography sx={{ fontSize: '12px', color: '#64748b', mb: 2 }}>Upload case files or reports for this check.</Typography>
                        <Button size="small" variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 15 }} />} onClick={() => handleOpenUpload('document')} sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}>
                          Upload Document
                        </Button>
                      </Box>
                    ) : (
                      <Stack spacing={1.5}>
                        {documents.map((doc, idx) => {
                          const docUrl = resolveMediaUrl(doc.url || doc.file_url);
                          return (
                            <Paper key={`doc-${idx}`} elevation={0} sx={{ p: 2, borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' } }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                                <Avatar sx={{ width: 36, height: 36, bgcolor: '#f1f5f9', color: '#0284c7' }}>
                                  <InsertDriveFile sx={{ fontSize: 20 }} />
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.filename}>
                                    {doc.filename || `Document_${idx + 1}`}
                                  </Typography>
                                  <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                    {formatFileSize(doc.size)} {doc.uploaded_at ? `• ${fmtDateDisplay(doc.uploaded_at)}` : ''}
                                  </Typography>
                                </Box>
                              </Box>

                              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ borderRadius: '6px', textTransform: 'none', fontSize: '12px', fontWeight: 600 }}
                                >
                                  Preview / View
                                </Button>
                              </Box>
                            </Paper>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>
                )}

              </Paper>

            </Stack>
          )}
        </Box>

        {/* ─── UPLOAD DIALOG ─────────────────────────────────────────────── */}
        <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
            Upload Check Media
            <IconButton onClick={() => setUploadOpen(false)} size="small">
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ py: 2.5 }}>
            <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
              <InputLabel>Category</InputLabel>
              <Select value={uploadCategory} label="Category" onChange={(e) => setUploadCategory(e.target.value)}>
                <MenuItem value="evidence">📷 Visit Photo</MenuItem>
                <MenuItem value="statement">🎙️ Statement Audio Recording</MenuItem>
                <MenuItem value="document">📄 Case Document / Report</MenuItem>
              </Select>
            </FormControl>

            {/* File Picker */}
            <Box sx={{ p: 3, border: '2px dashed #cbd5e1', borderRadius: '12px', textAlign: 'center', bgcolor: '#f8fafc', mb: 2, cursor: 'pointer', '&:hover': { borderColor: '#4f46e5', bgcolor: '#eef2ff' } }}>
              <input
                type="file"
                id="check-file-upload-input"
                style={{ display: 'none' }}
                accept={uploadCategory === 'evidence' ? 'image/*' : uploadCategory === 'statement' ? 'audio/*' : '*'}
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="check-file-upload-input" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                <CloudUpload sx={{ fontSize: 40, color: '#4f46e5', mb: 1 }} />
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  {uploadFile ? uploadFile.name : `Choose a ${uploadCategory === 'evidence' ? 'photo' : uploadCategory === 'statement' ? 'audio recording' : 'document'} file`}
                </Typography>
                <Typography sx={{ fontSize: '11.5px', color: '#64748b', mt: 0.5 }}>
                  {uploadFile ? `${formatFileSize(uploadFile.size)} • Click to change` : 'Click to browse files on your computer'}
                </Typography>
              </label>
            </Box>

            {/* Statement text optional field */}
            {uploadCategory === 'statement' && (
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Statement Text / Transcript (Optional)"
                placeholder="Enter text summary or transcript of this audio recording..."
                value={uploadStatementText}
                onChange={(e) => setUploadStatementText(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 1.5 }}>
            <Button onClick={() => setUploadOpen(false)} disabled={uploading} sx={{ textTransform: 'none', color: '#64748b' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleUploadSubmit}
              disabled={uploading || !uploadFile}
              startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />}
              sx={{ background: 'linear-gradient(135deg,#4f46e5,#3730a3)', textTransform: 'none', fontWeight: 700, borderRadius: '8px', px: 3 }}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ─── LIGHTBOX PHOTO PREVIEW DIALOG ────────────────────────────── */}
        <Dialog open={Boolean(activePhoto)} onClose={() => setActivePhoto(null)} maxWidth="md">
          <Box sx={{ position: 'relative', bgcolor: '#0f172a', p: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <IconButton
              onClick={() => setActivePhoto(null)}
              sx={{ position: 'absolute', top: 12, right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }, zIndex: 10 }}
            >
              <Close />
            </IconButton>
            {activePhoto && (
              <Box
                component="img"
                src={activePhoto}
                alt="Evidence Preview"
                sx={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: '4px' }}
              />
            )}
          </Box>
        </Dialog>

        
        {/* TAT CHANGE REQUEST MODAL */}
        <Dialog open={tatChangeOpen} onClose={() => setTatChangeOpen(false)} maxWidth="xs" fullWidth>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>Request TAT Days Change</Typography>
            <Stack spacing={2}>
              <TextField
                label="Updated TAT Days"
                type="number"
                fullWidth
                size="small"
                value={updatedTatDays}
                onChange={(e) => setUpdatedTatDays(e.target.value)}
                autoFocus
              />
              <TextField
                label="Reason for Change"
                multiline
                rows={3}
                fullWidth
                size="small"
                value={tatReason}
                onChange={(e) => setTatReason(e.target.value)}
                placeholder="Provide a detailed reason for the requested change"
              />
            </Stack>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 3 }}>
              <Button onClick={() => setTatChangeOpen(false)} color="inherit" sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button 
                onClick={handleTatChangeSubmit} 
                variant="contained" 
                disabled={!updatedTatDays || !tatReason || tatSubmitting}
                sx={{ textTransform: 'none', background: '#3b82f6' }}
              >
                {tatSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </Box>
          </Box>
        </Dialog>
{/* ── STICKY SAVE BAR ───────────────────────────────────────────── */}
        {editing && !loading && (
          <Box sx={{
            position: 'sticky', bottom: 0, zIndex: 100,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
            borderTop: '1px solid #e0e0e0',
            px: { xs: 2, md: 4 }, py: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 3px #fef3c7' }} />
              <Typography sx={{ fontSize: '13px', color: '#555', fontWeight: 500 }}>You have unsaved changes</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<Cancel sx={{ fontSize: 15 }} />} onClick={handleCancelEdit} disabled={saving} size="small"
                sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '13px' }}>
                Discard
              </Button>
              <Button variant="contained" startIcon={saving ? <CircularProgress size={13} color="inherit" /> : <Save sx={{ fontSize: 15 }} />}
                onClick={handleSave} disabled={saving} size="small"
                sx={{ background: meta.gradient, textTransform: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', px: 2.5 }}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </Box>
          </Box>
        )}

      </Box>
    </CaseManagerLayout>
  );
};

export default CheckDetailPage;
