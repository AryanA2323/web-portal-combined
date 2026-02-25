import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
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
  Tooltip,
  Avatar,
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
  ContactPhone,
  ArticleOutlined,
  GavelOutlined,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import api from '../../services/api';

// ─── Theme tokens ────────────────────────────────────────────────────────────

const CHECK_META = {
  claimant:    { label: 'Claimant Check',  color: '#e53935', bg: '#fce4ec', gradient: 'linear-gradient(135deg,#f5576c 0%,#e53935 100%)', icon: <Person /> },
  insured:     { label: 'Insured Check',   color: '#1565c0', bg: '#e3f2fd', gradient: 'linear-gradient(135deg,#4facfe 0%,#1565c0 100%)', icon: <AssignmentInd /> },
  driver:      { label: 'Driver Check',    color: '#2e7d32', bg: '#e8f5e9', gradient: 'linear-gradient(135deg,#43e97b 0%,#2e7d32 100%)', icon: <DirectionsCar /> },
  spot:        { label: 'Spot Check',      color: '#e65100', bg: '#fff3e0', gradient: 'linear-gradient(135deg,#fa709a 0%,#e65100 100%)', icon: <LocationOn /> },
  chargesheet: { label: 'Chargesheet',     color: '#6a1b9a', bg: '#f3e5f5', gradient: 'linear-gradient(135deg,#a18cd1 0%,#6a1b9a 100%)', icon: <Gavel /> },
};

const STATUS_CFG = {
  Pending:        { color: '#e65100', bg: '#fff3e0' },
  'In Progress':  { color: '#1565c0', bg: '#e3f2fd' },
  Completed:      { color: '#2e7d32', bg: '#e8f5e9' },
  Done:           { color: '#2e7d32', bg: '#e8f5e9' },
  Open:           { color: '#1565c0', bg: '#e3f2fd' },
  Closed:         { color: '#37474f', bg: '#eceff1' },
  WIP:            { color: '#1565c0', bg: '#e3f2fd' },
  Submitted:      { color: '#6a1b9a', bg: '#f3e5f5' },
  Approved:       { color: '#2e7d32', bg: '#e8f5e9' },
  Rejected:       { color: '#c62828', bg: '#ffebee' },
  'Under Review': { color: '#e65100', bg: '#fff3e0' },
  Cancelled:      { color: '#37474f', bg: '#eceff1' },
  'On Hold':      { color: '#6a1b9a', bg: '#f3e5f5' },
  'Not Started':  { color: '#78909c', bg: '#eceff1' },
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
  const d = new Date(String(v).slice(0, 10));
  if (isNaN(d)) return v;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const LONG_FIELDS = new Set(['statement', 'observation', 'observations', 'accident_brief', 'scope_of_work']);

// ─── Field definitions ────────────────────────────────────────────────────────

const CASE_FIELDS_DEF = [
  { name: 'claim_number',               label: 'Claim Number',    group: 'identity' },
  { name: 'client_name',                label: 'Client Name',     group: 'identity' },
  { name: 'category',                   label: 'Category',        group: 'identity', options: ['MACT','GPA','PA','Health','Fire','Marine','Misc'] },
  { name: 'case_type',                  label: 'Case Type',       group: 'identity', options: ['Full Case','Partial','Reinvestigation'] },
  { name: 'case_receipt_date',          label: 'Receipt Date',    group: 'dates',    type: 'date' },
  { name: 'case_due_date',              label: 'Due Date',        group: 'dates',    type: 'date' },
  { name: 'completion_date',            label: 'Completion Date', group: 'dates',    type: 'date' },
  { name: 'tat_days',                   label: 'TAT Days',        group: 'dates',    type: 'number' },
  { name: 'sla',                        label: 'SLA',             group: 'status',   options: ['AT','OT','BT','NT'] },
  { name: 'investigation_report_status',label: 'IR Status',       group: 'status',   options: ['Open','Submitted','Approved','Rejected','Under Review','Closed'] },
  { name: 'full_case_status',           label: 'Case Status',     group: 'status',   options: ['WIP','Completed','Pending','On Hold','Cancelled'] },
  { name: 'scope_of_work',              label: 'Scope of Work',   group: 'notes' },
];

const CHECK_FIELDS_DEF = {
  claimant: [
    { name: 'claimant_name',    label: 'Claimant Name', group: 'identity' },
    { name: 'claimant_contact', label: 'Contact',       group: 'identity' },
    { name: 'claimant_address', label: 'Address',       group: 'identity' },
    { name: 'claimant_income',  label: 'Income (₹)',    group: 'identity', type: 'number' },
    { name: 'check_status',     label: 'Check Status',  group: 'status',   options: ['Pending','In Progress','Completed','Done'] },
    { name: 'statement',        label: 'Statement',     group: 'notes' },
    { name: 'observation',      label: 'Observation',   group: 'notes' },
  ],
  insured: [
    { name: 'insured_name',    label: 'Insured Name',  group: 'identity' },
    { name: 'insured_contact', label: 'Contact',       group: 'identity' },
    { name: 'insured_address', label: 'Address',       group: 'identity' },
    { name: 'policy_number',   label: 'Policy Number', group: 'policy' },
    { name: 'policy_period',   label: 'Policy Period', group: 'policy' },
    { name: 'rc',              label: 'RC',            group: 'policy' },
    { name: 'permit',          label: 'Permit',        group: 'policy' },
    { name: 'check_status',    label: 'Check Status',  group: 'status',   options: ['Pending','In Progress','Completed','Done'] },
    { name: 'statement',       label: 'Statement',     group: 'notes' },
    { name: 'observation',     label: 'Observation',   group: 'notes' },
  ],
  driver: [
    { name: 'driver_name',    label: 'Driver Name',    group: 'identity' },
    { name: 'driver_contact', label: 'Contact',        group: 'identity' },
    { name: 'driver_address', label: 'Address',        group: 'identity' },
    { name: 'dl',             label: 'Driving Licence',group: 'licence' },
    { name: 'permit',         label: 'Permit',         group: 'licence' },
    { name: 'occupation',     label: 'Occupation',     group: 'licence' },
    { name: 'check_status',   label: 'Check Status',   group: 'status',   options: ['Pending','In Progress','Completed','Done'] },
    { name: 'statement',      label: 'Statement',      group: 'notes' },
    { name: 'observation',    label: 'Observation',    group: 'notes' },
  ],
  spot: [
    { name: 'time_of_accident',  label: 'Time of Accident',  group: 'accident' },
    { name: 'place_of_accident', label: 'Place of Accident', group: 'accident' },
    { name: 'district',          label: 'District',          group: 'accident' },
    { name: 'fir_number',        label: 'FIR Number',        group: 'fir' },
    { name: 'police_station',    label: 'Police Station',    group: 'fir' },
    { name: 'check_status',      label: 'Check Status',      group: 'status',  options: ['Pending','In Progress','Completed','Done'] },
    { name: 'accident_brief',    label: 'Accident Brief',    group: 'notes' },
    { name: 'observations',      label: 'Observations',      group: 'notes' },
  ],
  chargesheet: [
    { name: 'fir_number',     label: 'FIR Number',     group: 'legal' },
    { name: 'court_name',     label: 'Court Name',     group: 'legal' },
    { name: 'mv_act',         label: 'MV Act',         group: 'legal' },
    { name: 'fir_delay_days', label: 'FIR Delay Days', group: 'legal', type: 'number' },
    { name: 'bsn_section',    label: 'BSN Section',    group: 'legal' },
    { name: 'ipc',            label: 'IPC',            group: 'legal' },
    { name: 'check_status',   label: 'Check Status',   group: 'status', options: ['Pending','In Progress','Completed','Done'] },
    { name: 'statement',      label: 'Statement',      group: 'notes' },
    { name: 'observations',   label: 'Observations',   group: 'notes' },
  ],
};

const GROUP_ICONS = {
  identity: <BadgeOutlined sx={{ fontSize: 14 }} />,
  policy:   <VerifiedUser sx={{ fontSize: 14 }} />,
  licence:  <ArticleOutlined sx={{ fontSize: 14 }} />,
  accident: <LocationOn sx={{ fontSize: 14 }} />,
  fir:      <GavelOutlined sx={{ fontSize: 14 }} />,
  legal:    <GavelOutlined sx={{ fontSize: 14 }} />,
  dates:    <CalendarToday sx={{ fontSize: 14 }} />,
  status:   <CheckCircleOutline sx={{ fontSize: 14 }} />,
  notes:    <ArticleOutlined sx={{ fontSize: 14 }} />,
};

const GROUP_LABELS = {
  identity: 'Identity & Contact',
  policy:   'Policy Details',
  licence:  'Licence & Permit',
  accident: 'Accident Details',
  fir:      'FIR & Police',
  legal:    'Legal Information',
  dates:    'Timeline & Dates',
  status:   'Status',
  notes:    'Notes & Findings',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SectionLabel = ({ groupKey, accentColor }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 2, mt: 0.5 }}>
    <Box sx={{ color: accentColor, lineHeight: 0 }}>{GROUP_ICONS[groupKey]}</Box>
    <Typography sx={{ fontSize: '11px', fontWeight: 800, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
      {GROUP_LABELS[groupKey] || groupKey}
    </Typography>
    <Box sx={{ flex: 1, height: '1px', backgroundColor: `${accentColor}30`, ml: 0.5 }} />
  </Box>
);

const ViewField = ({ label, value, isStatus = false, isDate = false }) => (
  <Box sx={{ mb: 2.5 }}>
    <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.6 }}>
      {label}
    </Typography>
    {isStatus
      ? pill(value)
      : <Typography sx={{ fontSize: '13.5px', color: value ? '#1a1a2e' : '#c0c0c0', fontStyle: value ? 'normal' : 'italic', wordBreak: 'break-word', lineHeight: 1.5 }}>
          {isDate ? fmtDateDisplay(value) : (value || '—')}
        </Typography>
    }
  </Box>
);

const EditField = ({ label, name, value, onChange, type = 'text', options, multiline = false }) => {
  const val = value ?? '';
  if (options) {
    return (
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel sx={{ fontSize: '13px' }}>{label}</InputLabel>
        <Select value={val} label={label} onChange={(e) => onChange(name, e.target.value)} sx={{ fontSize: '13px', borderRadius: '8px' }}>
          {options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: '13px' }}>{o}</MenuItem>)}
        </Select>
      </FormControl>
    );
  }
  return (
    <TextField
      fullWidth size="small" label={label} type={type} value={val}
      onChange={(e) => onChange(name, e.target.value)}
      multiline={multiline} minRows={multiline ? 3 : undefined}
      sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' }, '& .MuiInputBase-input': { fontSize: '13px' } }}
      InputLabelProps={type === 'date' ? { shrink: true } : undefined}
    />
  );
};

const FieldBlock = ({ fd, value, editing, onChange }) => {
  const isLong   = LONG_FIELDS.has(fd.name);
  const isStatus = fd.name === 'check_status' || fd.name === 'full_case_status' || fd.name === 'investigation_report_status' || fd.name === 'sla';
  if (editing) return <EditField label={fd.label} name={fd.name} value={value} onChange={onChange} type={fd.type} options={fd.options} multiline={isLong} />;
  return <ViewField label={fd.label} value={value} isStatus={isStatus} isDate={fd.type === 'date'} />;
};

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

const FieldGroupRows = ({ fields, getVal, editing, onChange, accentColor }) => {
  const groups = [];
  const seen = {};
  fields.forEach((fd) => { if (!seen[fd.group]) { seen[fd.group] = true; groups.push(fd.group); } });
  return (
    <>
      {groups.map((g) => {
        const gFields = fields.filter((f) => f.group === g);
        return (
          <Box key={g} sx={{ mb: 2 }}>
            <SectionLabel groupKey={g} accentColor={accentColor} />
            <Grid container spacing={2}>
              {gFields.map((fd) => (
                <Grid item xs={12} sm={LONG_FIELDS.has(fd.name) ? 12 : 6} md={LONG_FIELDS.has(fd.name) ? 12 : 4} key={fd.name}>
                  <FieldBlock fd={fd} value={getVal(fd.name)} editing={editing} onChange={onChange} />
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}
    </>
  );
};

const LoadingSkeleton = () => (
  <Box>
    <Skeleton variant="rounded" height={80} sx={{ mb: 2.5, borderRadius: '12px' }} />
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}><Skeleton variant="rounded" height={460} sx={{ borderRadius: '14px' }} /></Grid>
      <Grid item xs={12} md={8}><Skeleton variant="rounded" height={460} sx={{ borderRadius: '14px' }} /></Grid>
    </Grid>
  </Box>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const CheckDetailPage = () => {
  const { caseId, checkType } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);

  const [caseData,   setCaseData]   = useState({});
  const [checkData,  setCheckData]  = useState({});
  const [caseDraft,  setCaseDraft]  = useState({});
  const [checkDraft, setCheckDraft] = useState({});

  const meta = CHECK_META[checkType] || { label: checkType, color: '#667eea', bg: '#f0f0ff', gradient: 'linear-gradient(135deg,#667eea,#764ba2)', icon: <FolderOpen /> };

  const fetchDetail = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/cases/incident-db/${caseId}/check/${checkType}`);
      setCaseData(res.data.case || {});
      setCheckData(res.data.check || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load details.');
    } finally { setLoading(false); }
  }, [caseId, checkType]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleStartEdit  = () => { setCaseDraft({ ...caseData }); setCheckDraft({ ...checkData }); setEditing(true); setSuccess(''); setError(''); };
  const handleCancelEdit = () => { setEditing(false); setCaseDraft({}); setCheckDraft({}); setSuccess(''); setError(''); };
  const handleCaseChange  = (n, v) => setCaseDraft((p) => ({ ...p, [n]: v }));
  const handleCheckChange = (n, v) => setCheckDraft((p) => ({ ...p, [n]: v }));

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put(`/cases/incident-db/${caseId}/check/${checkType}`, { case: caseDraft, check: checkDraft });
      setSuccess('Changes saved successfully.');
      setEditing(false);
      const res = await api.get(`/cases/incident-db/${caseId}/check/${checkType}`);
      setCaseData(res.data.case || {});
      setCheckData(res.data.check || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally { setSaving(false); }
  };

  const caseVal  = (n) => (editing ? caseDraft[n]  ?? '' : caseData[n]  ?? '');
  const checkVal = (n) => (editing ? checkDraft[n] ?? '' : checkData[n] ?? '');

  const irCfg  = STATUS_CFG[caseData.investigation_report_status] || { color: '#78909c', bg: '#eceff1' };
  const staCfg = STATUS_CFG[caseData.full_case_status]            || { color: '#78909c', bg: '#eceff1' };
  const checkFieldsDef = CHECK_FIELDS_DEF[checkType] || [];
  const latKey = checkType === 'spot' ? 'spot_lat' : `${checkType}_lat`;
  const lngKey = checkType === 'spot' ? 'spot_lng' : `${checkType}_lng`;

  return (
    <AdminLayout>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 2.5, opacity: 0.85 }}>
            <IconButton onClick={() => navigate('/admin/cases')} size="small" sx={{ color: '#fff', p: 0.5, '&:hover': { background: 'rgba(255,255,255,0.15)' } }}>
              <ArrowBack sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', '&:hover': { color: '#fff' } }} onClick={() => navigate('/admin/cases')}>
              Cases
            </Typography>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>›</Typography>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
              {caseData.claim_number || `Case #${caseId}`}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>›</Typography>
            <Typography sx={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{meta.label}</Typography>
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
              {!loading && !editing && (
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

        {/* ── CONTENT (overlaps banner) ──────────────────────────────────── */}
        <Box sx={{ px: { xs: 2, md: 4 }, mt: 2, pb: 5, maxWidth: 1280, mx: 'auto' }}>

          {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2, borderRadius: '10px' }}>{success}</Alert>}

          {/* ── Stat strip ── */}
          {!loading && (
            <Paper elevation={3} sx={{
              borderRadius: '14px', p: 2, mb: 3,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 1.5,
            }}>
              <StatBadge icon={<FolderOpen sx={{ fontSize: 18 }} />}         label="Claim Number"  value={caseData.claim_number}                         color="#667eea" />
              <StatBadge icon={<CalendarToday sx={{ fontSize: 18 }} />}      label="Receipt Date"  value={fmtDateDisplay(caseData.case_receipt_date)}     color="#06b6d4" />
              <StatBadge icon={<Speed sx={{ fontSize: 18 }} />}              label="TAT Days"      value={caseData.tat_days != null ? `${caseData.tat_days} days` : null} color="#f59e0b" />
              <StatBadge icon={<CheckCircleOutline sx={{ fontSize: 18 }} />} label="IR Status"     value={caseData.investigation_report_status}           color={irCfg.color} />
              <StatBadge icon={<VerifiedUser sx={{ fontSize: 18 }} />}       label="Case Status"   value={caseData.full_case_status}                      color={staCfg.color} />
              <StatBadge icon={<PinDrop sx={{ fontSize: 18 }} />}            label="Check Status"  value={checkData.check_status}                         color={meta.color} />
            </Paper>
          )}

          {loading ? <LoadingSkeleton /> : (
            <Grid container spacing={3}>

              {/* ── LEFT: Case Information ─────────────────────────────── */}
              <Grid item xs={12} md={4}>
                <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid #e8eaf6', overflow: 'hidden', height: '100%' }}>
                  <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, borderBottom: '1px solid #f0f0f8', display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Box sx={{ width: 6, height: 36, borderRadius: '3px', background: 'linear-gradient(135deg,#667eea,#764ba2)', flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e' }}>Case Information</Typography>
                      <Typography sx={{ fontSize: '11px', color: '#9e9e9e' }}>Common case fields</Typography>
                    </Box>
                    {editing && (
                      <Chip label="Editing" size="small" sx={{ ml: 'auto', background: '#e8eaf6', color: '#667eea', fontWeight: 700, fontSize: '10px', height: '20px' }} />
                    )}
                  </Box>
                  <Box sx={{ px: 2.5, pt: 2, pb: 2 }}>
                    <FieldGroupRows
                      fields={CASE_FIELDS_DEF}
                      getVal={caseVal}
                      editing={editing}
                      onChange={handleCaseChange}
                      accentColor="#667eea"
                    />
                  </Box>
                </Paper>
              </Grid>

              {/* ── RIGHT: Check Details ───────────────────────────────── */}
              <Grid item xs={12} md={8}>
                <Stack spacing={3}>

                  {/* Check detail card */}
                  <Paper elevation={0} sx={{ borderRadius: '14px', border: `1px solid ${meta.color}30`, overflow: 'hidden' }}>
                    <Box sx={{ height: '5px', background: meta.gradient }} />
                    <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <Avatar sx={{ width: 34, height: 34, background: meta.bg, color: meta.color, fontSize: '18px' }}>
                        {meta.icon}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e' }}>{meta.label} Details</Typography>
                        <Typography sx={{ fontSize: '11px', color: '#9e9e9e' }}>Specific investigation data</Typography>
                      </Box>
                      {checkData.check_status && <Box sx={{ ml: 'auto' }}>{pill(checkData.check_status)}</Box>}
                    </Box>
                    <Box sx={{ px: 2.5, pt: 2, pb: 2 }}>
                      {checkFieldsDef.length === 0
                        ? <Typography sx={{ color: '#bbb', fontStyle: 'italic', fontSize: '13px' }}>No fields defined.</Typography>
                        : <FieldGroupRows fields={checkFieldsDef} getVal={checkVal} editing={editing} onChange={handleCheckChange} accentColor={meta.color} />
                      }
                    </Box>
                  </Paper>

                  {/* Geocoordinates card */}
                  {['claimant', 'insured', 'driver', 'spot'].includes(checkType) && (
                    <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid #e8eaf6', overflow: 'hidden' }}>
                      <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f0f0f8', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PinDrop sx={{ fontSize: 18, color: '#06b6d4' }} />
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e' }}>Geocoordinates</Typography>
                        <Chip label="Auto-filled" size="small" sx={{ ml: 1, background: '#e0f7fa', color: '#00838f', fontWeight: 700, fontSize: '10px', height: '18px' }} />
                      </Box>
                      <Box sx={{ px: 2.5, py: 2 }}>
                        <Grid container spacing={2}>
                          {[{ key: latKey, label: 'Latitude' }, { key: lngKey, label: 'Longitude' }].map((c) => {
                            const raw = checkData[c.key];
                            return (
                              <Grid item xs={12} sm={6} key={c.key}>
                                <Box sx={{ background: '#f8faff', border: '1px solid #e8eaf6', borderRadius: '8px', px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <PinDrop sx={{ fontSize: 20, color: '#06b6d4', flexShrink: 0 }} />
                                  <Box>
                                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</Typography>
                                    <Typography sx={{ fontSize: '13px', fontFamily: 'monospace', color: raw != null ? '#1a1a2e' : '#c0c0c0', fontStyle: raw != null ? 'normal' : 'italic' }}>
                                      {raw != null ? Number(raw).toFixed(6) : 'pending geocoding…'}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Grid>
                            );
                          })}
                        </Grid>
                        {checkData[latKey] != null && checkData[lngKey] != null && (
                          <Box sx={{ mt: 1.5 }}>
                            <Button
                              size="small"
                              startIcon={<LocationOn sx={{ fontSize: 15 }} />}
                              href={`https://maps.google.com/?q=${checkData[latKey]},${checkData[lngKey]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ textTransform: 'none', fontSize: '12px', color: '#06b6d4', '&:hover': { background: '#e0f7fa' }, borderRadius: '6px' }}
                            >
                              View on Google Maps
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  )}

                </Stack>
              </Grid>

            </Grid>
          )}
        </Box>

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
    </AdminLayout>
  );
};

export default CheckDetailPage;
