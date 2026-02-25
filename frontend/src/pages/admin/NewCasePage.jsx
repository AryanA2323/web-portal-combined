import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Card,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { 
  Save, 
  ArrowBack,
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import api from '../../services/api';

const NewCasePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ===================== Common Case Fields (top section) =====================
  const [commonFields, setCommonFields] = useState({
    claim_number: '',
    client_name: '',
    category: 'MACT',
    case_receipt_date: '',
    receipt_month: '',
    completion_date: '',
    completion_month: '',
    case_due_date: '',
    tat_days: '',
    sla_status: '',
    case_type: 'Full Case',
    investigation_report_status: 'Open',
    full_case_status: 'WIP',
    scope_of_work: '',
  });

  // Auto-compute receipt_month when case_receipt_date changes
  useEffect(() => {
    if (commonFields.case_receipt_date) {
      const d = new Date(commonFields.case_receipt_date);
      const month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      setCommonFields(prev => ({ ...prev, receipt_month: month }));
    }
  }, [commonFields.case_receipt_date]);

  // Auto-compute completion_month when completion_date changes
  useEffect(() => {
    if (commonFields.completion_date) {
      const d = new Date(commonFields.completion_date);
      const month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      setCommonFields(prev => ({ ...prev, completion_month: month }));
    }
  }, [commonFields.completion_date]);

  // Auto-compute TAT when both receipt and completion dates exist
  useEffect(() => {
    if (commonFields.case_receipt_date && commonFields.completion_date) {
      const start = new Date(commonFields.case_receipt_date);
      const end = new Date(commonFields.completion_date);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      setCommonFields(prev => ({ ...prev, tat_days: diff >= 0 ? diff.toString() : '' }));
    }
  }, [commonFields.case_receipt_date, commonFields.completion_date]);

  const handleCommonFieldChange = (e) => {
    const { name, value } = e.target;
    setCommonFields(prev => ({ ...prev, [name]: value }));
  };

  // ===================== Verification Type Selection =====================
  const [selectedVerifications, setSelectedVerifications] = useState({
    claimant: false,
    insured: false,
    driver: false,
    spot: false,
    chargesheet: false,
  });

  // File uploads for each verification type
  const [verificationFiles, setVerificationFiles] = useState({
    claimant: [],
    insured: [],
    driver: [],
    spot: [],
    chargesheet: [],
  });

  // Verification-specific data
  const [verificationData, setVerificationData] = useState({
    // Per-verification-type common fields (each type gets own status/statement/observations)
    claimant_check_status: 'WIP',
    claimant_statement: '',
    claimant_observations: '',
    insured_check_status: 'WIP',
    insured_statement: '',
    insured_observations: '',
    driver_check_status: 'WIP',
    driver_statement: '',
    driver_observations: '',
    spot_check_status: 'WIP',
    spot_statement: '',
    spot_observations: '',
    chargesheet_check_status: 'WIP',
    chargesheet_statement: '',
    chargesheet_observations: '',
    
    // Claimant fields
    claimant_name: '',
    claimant_contact: '',
    claimant_address: '',
    income: '',
    fir_number_claimant: '',
    court_name: '',
    mv_act: '',
    
    // Insured fields
    insured_name: '',
    insured_contact: '',
    insured_address: '',
    policy_number: '',
    policy_period: '',
    rc_number: '',
    permit_insured: '',
    
    // Driver fields
    driver_name: '',
    driver_contact: '',
    driver_address: '',
    dl_number: '',
    permit_driver: '',
    occupation: '',
    driver_and_insured_same: false,
    
    // Spot fields
    time_of_accident: '',
    place_of_accident: '',
    district: '',
    fir_number_spot: '',
    police_station: '',
    accident_brief: '',
    
    // Chargesheet fields
    fir_delay_in_days: '',
    bsn_sections: '',
    ipc_sections: '',
  });

  // Dependents for Claimant Check
  const [dependents, setDependents] = useState([]);

  const handleVerificationSelect = (e) => {
    const { name, checked } = e.target;
    setSelectedVerifications(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleVerificationChange = (e) => {
    const { name, value, type, checked } = e.target;
    setVerificationData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddDependent = () => {
    setDependents([...dependents, {
      dependent_name: '',
      dependent_contact: '',
      dependent_address: '',
      relationship: '',
      age: '',
    }]);
  };

  const handleRemoveDependent = (index) => {
    setDependents(dependents.filter((_, i) => i !== index));
  };

  const handleDependentChange = (index, field, value) => {
    const newDependents = [...dependents];
    newDependents[index][field] = value;
    setDependents(newDependents);
  };

  // File upload handlers
  const handleFileSelect = (verificationType, e) => {
    const files = Array.from(e.target.files);
    setVerificationFiles(prev => ({
      ...prev,
      [verificationType]: [...prev[verificationType], ...files]
    }));
  };

  const handleRemoveFile = (verificationType, index) => {
    setVerificationFiles(prev => ({
      ...prev,
      [verificationType]: prev[verificationType].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate required common fields
      if (!commonFields.claim_number.trim()) {
        setError('Claim Number is required');
        setLoading(false);
        return;
      }

      // Build the case payload from common fields
      const payload = {
        // Common fields
        claim_number: commonFields.claim_number,
        client_name: commonFields.client_name,
        category: commonFields.category,
        case_receipt_date: commonFields.case_receipt_date || null,
        receipt_month: commonFields.receipt_month,
        completion_date: commonFields.completion_date || null,
        completion_month: commonFields.completion_month,
        case_due_date: commonFields.case_due_date || null,
        tat_days: commonFields.tat_days ? parseInt(commonFields.tat_days) : null,
        sla_status: commonFields.sla_status,
        case_type: commonFields.case_type,
        investigation_report_status: commonFields.investigation_report_status,
        full_case_status: commonFields.full_case_status,
        scope_of_work: commonFields.scope_of_work,
        // System defaults
        title: `Case ${commonFields.claim_number} - ${commonFields.client_name || 'New Case'}`,
        description: '',
        priority: 'MEDIUM',
        status: 'OPEN',
        client_code: '',
        insured_name: '',
        claimant_name: '',
        incident_address: '',
        incident_city: '',
        incident_state: '',
        incident_postal_code: '',
        incident_country: 'India',
        source: 'MANUAL',
        workflow_type: 'STANDARD',
      };

      // Create the case
      const response = await api.post('/cases', payload);
      const caseId = response.data.id;
      const incidentCaseDbId = response.data.incident_case_db_id;

      // Create verification records only for selected types
      const verificationsToCreate = [];
      
      if (selectedVerifications.claimant) {
        verificationsToCreate.push({
          case_id: caseId,
          incident_case_db_id: incidentCaseDbId,
          check_type: 'CLAIMANT',
          check_status: verificationData.claimant_check_status || 'WIP',
          statement: verificationData.claimant_statement,
          observations: verificationData.claimant_observations,
          claimant_name: verificationData.claimant_name,
          claimant_contact: verificationData.claimant_contact,
          claimant_address: verificationData.claimant_address,
          income: verificationData.income ? parseFloat(verificationData.income) : null,
        });
      }

      if (selectedVerifications.insured) {
        verificationsToCreate.push({
          case_id: caseId,
          incident_case_db_id: incidentCaseDbId,
          check_type: 'INSURED',
          check_status: verificationData.insured_check_status || 'WIP',
          statement: verificationData.insured_statement,
          observations: verificationData.insured_observations,
          insured_name: verificationData.insured_name,
          insured_contact: verificationData.insured_contact,
          insured_address: verificationData.insured_address,
          policy_number: verificationData.policy_number,
          policy_period: verificationData.policy_period,
          rc_number: verificationData.rc_number,
          permit_insured: verificationData.permit_insured,
        });
      }

      if (selectedVerifications.driver) {
        verificationsToCreate.push({
          case_id: caseId,
          incident_case_db_id: incidentCaseDbId,
          check_type: 'DRIVER',
          check_status: verificationData.driver_check_status || 'WIP',
          statement: verificationData.driver_statement,
          observations: verificationData.driver_observations,
          driver_name: verificationData.driver_name,
          driver_contact: verificationData.driver_contact,
          driver_address: verificationData.driver_address,
          dl_number: verificationData.dl_number,
          permit_driver: verificationData.permit_driver,
          occupation: verificationData.occupation,
          driver_and_insured_same: verificationData.driver_and_insured_same,
        });
      }

      if (selectedVerifications.spot) {
        verificationsToCreate.push({
          case_id: caseId,
          incident_case_db_id: incidentCaseDbId,
          check_type: 'SPOT',
          check_status: verificationData.spot_check_status || 'WIP',
          statement: verificationData.spot_statement,
          observations: verificationData.spot_observations,
          time_of_accident: verificationData.time_of_accident,
          place_of_accident: verificationData.place_of_accident,
          district: verificationData.district,
          fir_number_spot: verificationData.fir_number_spot,
          police_station: verificationData.police_station,
          accident_brief: verificationData.accident_brief,
        });
      }

      if (selectedVerifications.chargesheet) {
        verificationsToCreate.push({
          case_id: caseId,
          incident_case_db_id: incidentCaseDbId,
          check_type: 'CHARGESHEET',
          check_status: verificationData.chargesheet_check_status || 'WIP',
          statement: verificationData.chargesheet_statement,
          observations: verificationData.chargesheet_observations,
          fir_number_claimant: verificationData.fir_number_claimant,
          court_name: verificationData.court_name,
          mv_act: verificationData.mv_act,
          fir_delay_in_days: verificationData.fir_delay_in_days ? parseInt(verificationData.fir_delay_in_days) : null,
          bsn_sections: verificationData.bsn_sections,
          ipc_sections: verificationData.ipc_sections,
        });
      }

      // Create all selected verification records and upload files
      for (const verification of verificationsToCreate) {
        const verificationResponse = await api.post('/verifications', verification);
        const verificationId = verificationResponse.data.id;
        
       // Upload files for this verification if any
        const verificationType = verification.check_type.toLowerCase();
        if (verificationFiles[verificationType] && verificationFiles[verificationType].length > 0) {
          const formData = new FormData();
          verificationFiles[verificationType].forEach((file) => {
            formData.append('files', file);
          });
          
          try {
            await api.post(`/verifications/${verificationId}/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });
          } catch (uploadError) {
            console.error(`Failed to upload files for ${verificationType}:`, uploadError);
            // Continue with other verifications even if upload fails
          }
        }
      }

      // Create dependent records if Claimant verification is selected
      if (selectedVerifications.claimant && dependents.length > 0) {
        for (const dependent of dependents) {
          if (dependent.dependent_name) {
            await api.post('/verifications/dependents', {
              case_id: caseId,
              ...dependent,
              age: dependent.age ? parseInt(dependent.age) : null,
            });
          }
        }
      }
      
      setSuccess(`Case created successfully! Case Number: ${response.data.case_number}`);
      
      // Redirect to cases page after 2 seconds
      setTimeout(() => {
        navigate('/admin/cases');
      }, 2000);
      
    } catch (error) {
      console.error('Failed to create case:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      // Show detailed error message
      let errorMessage = 'Failed to create case. Please try again.';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage = JSON.stringify(error.response.data);
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/cases');
  };

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4">
            Create Verification Case
          </Typography>
          <Button
            startIcon={<ArrowBack />}
            onClick={handleCancel}
            variant="outlined"
          >
            Back to Cases
          </Button>
        </Box>

        {/* Error/Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Form */}
        <Paper sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            {/* ========== COMMON CASE FIELDS (TOP SECTION) ========== */}
            <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
              <Box sx={{ bgcolor: '#1565c0', color: 'white', p: 2 }}>
                <Typography variant="h6" fontWeight="600">
                  Case Information
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  Fill in the common details for this case
                </Typography>
              </Box>
              <Box sx={{ p: 3 }}>

                {/* ── Group 1: Case Identification ─────────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#1565c0' }} />
                  <Typography variant="overline" sx={{ fontWeight: 700, color: '#1565c0', letterSpacing: '1px', lineHeight: 1 }}>
                    Case Identification
                  </Typography>
                </Box>
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Claim Number *"
                      name="claim_number"
                      value={commonFields.claim_number}
                      onChange={handleCommonFieldChange}
                      required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Client Name"
                      name="client_name"
                      value={commonFields.client_name}
                      onChange={handleCommonFieldChange}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Category</InputLabel>
                      <Select
                        name="category"
                        value={commonFields.category}
                        onChange={handleCommonFieldChange}
                        label="Category"
                        sx={{ borderRadius: '8px' }}
                      >
                        <MenuItem value="MACT">MACT</MenuItem>
                        <MenuItem value="CIVIL">Civil</MenuItem>
                        <MenuItem value="CRIMINAL">Criminal</MenuItem>
                        <MenuItem value="CONSUMER">Consumer Forum</MenuItem>
                        <MenuItem value="OTHER">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider sx={{ mb: 2.5 }} />

                {/* ── Group 2: Timeline ────────────────────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#0288d1' }} />
                  <Typography variant="overline" sx={{ fontWeight: 700, color: '#0288d1', letterSpacing: '1px', lineHeight: 1 }}>
                    Timeline &amp; TAT
                  </Typography>
                </Box>
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Receipt Date"
                      name="case_receipt_date"
                      type="date"
                      value={commonFields.case_receipt_date}
                      onChange={handleCommonFieldChange}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Receipt Month"
                      name="receipt_month"
                      value={commonFields.receipt_month}
                      onChange={handleCommonFieldChange}
                      helperText="Auto-filled from receipt date"
                      InputProps={{ readOnly: !!commonFields.case_receipt_date }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: commonFields.case_receipt_date ? '#f5f5f5' : undefined } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Completion Date"
                      name="completion_date"
                      type="date"
                      value={commonFields.completion_date}
                      onChange={handleCommonFieldChange}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Completion Month"
                      name="completion_month"
                      value={commonFields.completion_month}
                      onChange={handleCommonFieldChange}
                      helperText="Auto-filled from completion date"
                      InputProps={{ readOnly: !!commonFields.completion_date }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: commonFields.completion_date ? '#f5f5f5' : undefined } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Case Due Date"
                      name="case_due_date"
                      type="date"
                      value={commonFields.case_due_date}
                      onChange={handleCommonFieldChange}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="TAT (Days)"
                      name="tat_days"
                      type="number"
                      value={commonFields.tat_days}
                      onChange={handleCommonFieldChange}
                      helperText="Auto-calculated from dates"
                      InputProps={{ readOnly: !!(commonFields.case_receipt_date && commonFields.completion_date) }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: (commonFields.case_receipt_date && commonFields.completion_date) ? '#f5f5f5' : undefined } }}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ mb: 2.5 }} />

                {/* ── Group 3: Classification & Status ─────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                  <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>
                    Classification &amp; Status
                  </Typography>
                </Box>
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>SLA Status</InputLabel>
                      <Select
                        name="sla_status"
                        value={commonFields.sla_status}
                        onChange={handleCommonFieldChange}
                        label="SLA Status"
                        sx={{ borderRadius: '8px' }}
                      >
                        <MenuItem value=""><em>Select</em></MenuItem>
                        <MenuItem value="AT">AT — Achieved TAT</MenuItem>
                        <MenuItem value="WT">WT — Within TAT</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Case Type</InputLabel>
                      <Select
                        name="case_type"
                        value={commonFields.case_type}
                        onChange={handleCommonFieldChange}
                        label="Case Type"
                        sx={{ borderRadius: '8px' }}
                      >
                        <MenuItem value=""><em>Select</em></MenuItem>
                        <MenuItem value="Full Case">Full Case</MenuItem>
                        <MenuItem value="Partial Case">Partial Case</MenuItem>
                        <MenuItem value="Reassessment">Reassessment</MenuItem>
                        <MenuItem value="Connected Case">Connected Case</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Investigation Report</InputLabel>
                      <Select
                        name="investigation_report_status"
                        value={commonFields.investigation_report_status}
                        onChange={handleCommonFieldChange}
                        label="Investigation Report"
                        sx={{ borderRadius: '8px' }}
                      >
                        <MenuItem value="Open">Open</MenuItem>
                        <MenuItem value="Approval">Approval</MenuItem>
                        <MenuItem value="Stop">Stop</MenuItem>
                        <MenuItem value="QC">QC</MenuItem>
                        <MenuItem value="Dispatch">Dispatch</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Full Case Status</InputLabel>
                      <Select
                        name="full_case_status"
                        value={commonFields.full_case_status}
                        onChange={handleCommonFieldChange}
                        label="Full Case Status"
                        sx={{ borderRadius: '8px' }}
                      >
                        <MenuItem value="WIP">WIP</MenuItem>
                        <MenuItem value="Pending CS">Pending CS</MenuItem>
                        <MenuItem value="Completed">Completed</MenuItem>
                        <MenuItem value="IR-Writing">IR-Writing</MenuItem>
                        <MenuItem value="NI">NI</MenuItem>
                        <MenuItem value="Withdraw">Withdraw</MenuItem>
                        <MenuItem value="QC-1">QC-1</MenuItem>
                        <MenuItem value="Pending Additional Docs">Pending Additional Docs</MenuItem>
                        <MenuItem value="Connected Pending">Connected Pending</MenuItem>
                        <MenuItem value="RCU Pending">RCU Pending</MenuItem>
                        <MenuItem value="Portal Upload">Portal Upload</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider sx={{ mb: 2.5 }} />

                {/* ── Group 4: Scope of Work ────────────────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                  <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>
                    Scope of Work
                  </Typography>
                </Box>
                <Grid container>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Scope of Work"
                      name="scope_of_work"
                      value={commonFields.scope_of_work}
                      onChange={handleCommonFieldChange}
                      multiline
                      rows={2}
                      placeholder="Describe the scope of investigation work for this case..."
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                </Grid>

              </Box>
            </Card>

            {/* ========== VERIFICATION TYPE SELECTION ========== */}
            <Typography variant="h6" gutterBottom sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
              Required Verifications
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select the verification checks required for this case. Fields for selected verifications will appear below.
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  elevation={selectedVerifications.claimant ? 4 : 1}
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: selectedVerifications.claimant ? '2px solid #1976d2' : '2px solid transparent',
                    transition: 'all 0.3s',
                    '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                  }}
                  onClick={() => handleVerificationSelect({ target: { name: 'claimant' } })}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="claimant"
                        checked={selectedVerifications.claimant}
                        onChange={handleVerificationSelect}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="bold">Claimant Check</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Claimant details, income, legal info
                        </Typography>
                      </Box>
                    }
                  />
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  elevation={selectedVerifications.insured ? 4 : 1}
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: selectedVerifications.insured ? '2px solid #2e7d32' : '2px solid transparent',
                    transition: 'all 0.3s',
                    '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                  }}
                  onClick={() => handleVerificationSelect({ target: { name: 'insured' } })}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="insured"
                        checked={selectedVerifications.insured}
                        onChange={handleVerificationSelect}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="bold">Insured Check</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Policy, RC, vehicle details
                        </Typography>
                      </Box>
                    }
                  />
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  elevation={selectedVerifications.driver ? 4 : 1}
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: selectedVerifications.driver ? '2px solid #ed6c02' : '2px solid transparent',
                    transition: 'all 0.3s',
                    '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                  }}
                  onClick={() => handleVerificationSelect({ target: { name: 'driver' } })}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="driver"
                        checked={selectedVerifications.driver}
                        onChange={handleVerificationSelect}
                        color="warning"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="bold">Driver Check</Typography>
                        <Typography variant="caption" color="text.secondary">
                          License, permit, occupation
                        </Typography>
                      </Box>
                    }
                  />
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  elevation={selectedVerifications.spot ? 4 : 1}
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: selectedVerifications.spot ? '2px solid #9c27b0' : '2px solid transparent',
                    transition: 'all 0.3s',
                    '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                  }}
                  onClick={() => handleVerificationSelect({ target: { name: 'spot' } })}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="spot"
                        checked={selectedVerifications.spot}
                        onChange={handleVerificationSelect}
                        color="secondary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="bold">Spot Check</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Accident location and details
                        </Typography>
                      </Box>
                    }
                  />
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  elevation={selectedVerifications.chargesheet ? 4 : 1}
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: selectedVerifications.chargesheet ? '2px solid #d32f2f' : '2px solid transparent',
                    transition: 'all 0.3s',
                    '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                  }}
                  onClick={() => handleVerificationSelect({ target: { name: 'chargesheet' } })}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="chargesheet"
                        checked={selectedVerifications.chargesheet}
                        onChange={handleVerificationSelect}
                        color="error"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="bold">Chargesheet</Typography>
                        <Typography variant="caption" color="text.secondary">
                          FIR delay, legal sections
                        </Typography>
                      </Box>
                    }
                  />
                </Card>
              </Grid>
            </Grid>

            {/* Show verification fields only if at least one verification is selected */}
            {(selectedVerifications.claimant || selectedVerifications.insured || 
              selectedVerifications.driver || selectedVerifications.spot || 
              selectedVerifications.chargesheet) && (
              <>
                <Divider sx={{ my: 4 }} />

                {/* Claimant Check Fields */}
                {selectedVerifications.claimant && (
                  <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                    <Box sx={{ bgcolor: '#1976d2', color: 'white', p: 2 }}>
                      <Typography variant="h6" fontWeight="600">Claimant Check</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>Personal details, dependents &amp; findings</Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>

                      {/* ── Personal Details ─────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#1976d2' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#1976d2', letterSpacing: '1px', lineHeight: 1 }}>Personal Details</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Claimant Name" name="claimant_name"
                            value={verificationData.claimant_name} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Claimant Contact" name="claimant_contact"
                            value={verificationData.claimant_contact} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Claimant Address" name="claimant_address"
                            value={verificationData.claimant_address} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Dependents ───────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#0288d1' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#0288d1', letterSpacing: '1px', lineHeight: 1 }}>Dependents &amp; Income</Typography>
                      </Box>
                      {dependents.map((dependent, index) => (
                        <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }} key={index}>
                          <Grid item xs={12} sm={3}>
                            <TextField fullWidth size="small" label="Dependent Name"
                              value={dependent.dependent_name}
                              onChange={(e) => handleDependentChange(index, 'dependent_name', e.target.value)}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField fullWidth size="small" label="Dependent Contact"
                              value={dependent.dependent_contact}
                              onChange={(e) => handleDependentChange(index, 'dependent_contact', e.target.value)}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={5}>
                            <TextField fullWidth size="small" label="Dependent Address"
                              value={dependent.dependent_address}
                              onChange={(e) => handleDependentChange(index, 'dependent_address', e.target.value)}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={1}>
                            <IconButton color="error" onClick={() => handleRemoveDependent(index)} size="small"><DeleteIcon /></IconButton>
                          </Grid>
                        </Grid>
                      ))}
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={3}>
                          <TextField fullWidth size="small" label="Income" name="income" type="number"
                            value={verificationData.income} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={3} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Button startIcon={<AddIcon />} onClick={handleAddDependent} variant="outlined" size="small" sx={{ borderRadius: '8px' }}>Add Dependent</Button>
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Status & Findings ────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; Findings</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Check Status</InputLabel>
                            <Select name="claimant_check_status" value={verificationData.claimant_check_status}
                              onChange={handleVerificationChange} label="Check Status" sx={{ borderRadius: '8px' }}>
                              <MenuItem value="Not Initiated">Not Initiated</MenuItem>
                              <MenuItem value="WIP">WIP</MenuItem>
                              <MenuItem value="Completed">Completed</MenuItem>
                              <MenuItem value="Stop">Stop</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Statement" name="claimant_statement"
                            value={verificationData.claimant_statement} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Observations" name="claimant_observations"
                            value={verificationData.claimant_observations} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Documents ────────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>Documents</Typography>
                      </Box>
                      <Button variant="outlined" component="label" size="small" sx={{ borderRadius: '8px' }}>
                        Upload Documents
                        <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileSelect('claimant', e)} />
                      </Button>
                      {verificationFiles.claimant.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                          {verificationFiles.claimant.map((file, index) => (
                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                              <AttachFileIcon fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ flex: 1 }}>{file.name}</Typography>
                              <IconButton size="small" color="error" onClick={() => handleRemoveFile('claimant', index)}><DeleteIcon fontSize="small" /></IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

                    </Box>
                  </Card>
                )}

                {/* Insured Check Fields */}
                {selectedVerifications.insured && (
                  <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                    <Box sx={{ bgcolor: '#2e7d32', color: 'white', p: 2 }}>
                      <Typography variant="h6" fontWeight="600">Insured Check</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>Personal details, policy &amp; vehicle information</Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>

                      {/* ── Personal Details ─────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>Personal Details</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Insured Name" name="insured_name"
                            value={verificationData.insured_name} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Insured Contact" name="insured_contact"
                            value={verificationData.insured_contact} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Insured Address" name="insured_address"
                            value={verificationData.insured_address} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Policy & Vehicle ─────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#0288d1' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#0288d1', letterSpacing: '1px', lineHeight: 1 }}>Policy &amp; Vehicle</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={3}>
                          <TextField fullWidth size="small" label="Policy Number" name="policy_number"
                            value={verificationData.policy_number} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField fullWidth size="small" label="Policy Period" name="policy_period"
                            value={verificationData.policy_period} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField fullWidth size="small" label="RC Number" name="rc_number"
                            value={verificationData.rc_number} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField fullWidth size="small" label="Permit" name="permit_insured"
                            value={verificationData.permit_insured} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Status & Findings ────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; Findings</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Check Status</InputLabel>
                            <Select name="insured_check_status" value={verificationData.insured_check_status}
                              onChange={handleVerificationChange} label="Check Status" sx={{ borderRadius: '8px' }}>
                              <MenuItem value="Not Initiated">Not Initiated</MenuItem>
                              <MenuItem value="WIP">WIP</MenuItem>
                              <MenuItem value="Completed">Completed</MenuItem>
                              <MenuItem value="Stop">Stop</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Statement" name="insured_statement"
                            value={verificationData.insured_statement} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Observations" name="insured_observations"
                            value={verificationData.insured_observations} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Documents ────────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>Documents</Typography>
                      </Box>
                      <Button variant="outlined" component="label" size="small" sx={{ borderRadius: '8px' }}>
                        Upload Documents
                        <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileSelect('insured', e)} />
                      </Button>
                      {verificationFiles.insured.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                          {verificationFiles.insured.map((file, index) => (
                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                              <AttachFileIcon fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ flex: 1 }}>{file.name}</Typography>
                              <IconButton size="small" color="error" onClick={() => handleRemoveFile('insured', index)}><DeleteIcon fontSize="small" /></IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

                    </Box>
                  </Card>
                )}

                {/* Driver Check Fields */}
                {selectedVerifications.driver && (
                  <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                    <Box sx={{ bgcolor: '#ed6c02', color: 'white', p: 2 }}>
                      <Typography variant="h6" fontWeight="600">Driver Check</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>Personal details, license &amp; vehicle permit</Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>

                      {/* ── Personal Details ─────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#ed6c02' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#ed6c02', letterSpacing: '1px', lineHeight: 1 }}>Personal Details</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Driver Name" name="driver_name"
                            value={verificationData.driver_name} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Driver Contact" name="driver_contact"
                            value={verificationData.driver_contact} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Driver Address" name="driver_address"
                            value={verificationData.driver_address} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── License & Work ────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#0288d1' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#0288d1', letterSpacing: '1px', lineHeight: 1 }}>License &amp; Work</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Driving License (DL)" name="dl_number"
                            value={verificationData.dl_number} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Permit" name="permit_driver"
                            value={verificationData.permit_driver} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Occupation" name="occupation"
                            value={verificationData.occupation} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Checkbox checked={verificationData.driver_and_insured_same}
                                onChange={(e) => handleVerificationChange({ target: { name: 'driver_and_insured_same', type: 'checkbox', checked: e.target.checked } })}
                                name="driver_and_insured_same" />
                            }
                            label="Driver and Insured is Same"
                          />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Status & Findings ────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; Findings</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Check Status</InputLabel>
                            <Select name="driver_check_status" value={verificationData.driver_check_status}
                              onChange={handleVerificationChange} label="Check Status" sx={{ borderRadius: '8px' }}>
                              <MenuItem value="Not Initiated">Not Initiated</MenuItem>
                              <MenuItem value="WIP">WIP</MenuItem>
                              <MenuItem value="Completed">Completed</MenuItem>
                              <MenuItem value="Stop">Stop</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Statement" name="driver_statement"
                            value={verificationData.driver_statement} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Observations" name="driver_observations"
                            value={verificationData.driver_observations} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Documents ────────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>Documents</Typography>
                      </Box>
                      <Button variant="outlined" component="label" size="small" sx={{ borderRadius: '8px' }}>
                        Upload Documents
                        <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileSelect('driver', e)} />
                      </Button>
                      {verificationFiles.driver.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                          {verificationFiles.driver.map((file, index) => (
                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                              <AttachFileIcon fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ flex: 1 }}>{file.name}</Typography>
                              <IconButton size="small" color="error" onClick={() => handleRemoveFile('driver', index)}><DeleteIcon fontSize="small" /></IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

                    </Box>
                  </Card>
                )}

                {/* Spot Check Fields */}
                {selectedVerifications.spot && (
                  <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                    <Box sx={{ bgcolor: '#9c27b0', color: 'white', p: 2 }}>
                      <Typography variant="h6" fontWeight="600">Spot Check</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>Accident location, FIR details &amp; findings</Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>

                      {/* ── Accident Location ────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#9c27b0' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#9c27b0', letterSpacing: '1px', lineHeight: 1 }}>Accident Location</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Time of Accident" name="time_of_accident"
                            value={verificationData.time_of_accident} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Place of Accident" name="place_of_accident"
                            value={verificationData.place_of_accident} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="District" name="district"
                            value={verificationData.district} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── FIR & Police ─────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#0288d1' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#0288d1', letterSpacing: '1px', lineHeight: 1 }}>FIR &amp; Police</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="FIR Number" name="fir_number_spot"
                            value={verificationData.fir_number_spot} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Police Station" name="police_station"
                            value={verificationData.police_station} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Accident Brief" name="accident_brief"
                            value={verificationData.accident_brief} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Status & Findings ────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; Findings</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Check Status</InputLabel>
                            <Select name="spot_check_status" value={verificationData.spot_check_status}
                              onChange={handleVerificationChange} label="Check Status" sx={{ borderRadius: '8px' }}>
                              <MenuItem value="Not Initiated">Not Initiated</MenuItem>
                              <MenuItem value="WIP">WIP</MenuItem>
                              <MenuItem value="Completed">Completed</MenuItem>
                              <MenuItem value="Stop">Stop</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Statement" name="spot_statement"
                            value={verificationData.spot_statement} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Observations" name="spot_observations"
                            value={verificationData.spot_observations} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Documents ────────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>Documents</Typography>
                      </Box>
                      <Button variant="outlined" component="label" size="small" sx={{ borderRadius: '8px' }}>
                        Upload Documents
                        <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileSelect('spot', e)} />
                      </Button>
                      {verificationFiles.spot.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                          {verificationFiles.spot.map((file, index) => (
                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                              <AttachFileIcon fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ flex: 1 }}>{file.name}</Typography>
                              <IconButton size="small" color="error" onClick={() => handleRemoveFile('spot', index)}><DeleteIcon fontSize="small" /></IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

                    </Box>
                  </Card>
                )}

                {/* Chargesheet Fields */}
                {selectedVerifications.chargesheet && (
                  <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                    <Box sx={{ bgcolor: '#d32f2f', color: 'white', p: 2 }}>
                      <Typography variant="h6" fontWeight="600">Chargesheet Check</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>Legal references, sections &amp; findings</Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>

                      {/* ── Legal Reference ───────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#d32f2f' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#d32f2f', letterSpacing: '1px', lineHeight: 1 }}>Legal Reference</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="FIR Number" name="fir_number_claimant"
                            value={verificationData.fir_number_claimant} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="Court Name" name="court_name"
                            value={verificationData.court_name} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="MV Act" name="mv_act"
                            value={verificationData.mv_act} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Chargesheet Details ───────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#0288d1' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#0288d1', letterSpacing: '1px', lineHeight: 1 }}>Chargesheet Details</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="FIR Delay (Days)" name="fir_delay_in_days" type="number"
                            value={verificationData.fir_delay_in_days} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="BSN Sections" name="bsn_sections"
                            value={verificationData.bsn_sections} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField fullWidth size="small" label="IPC Sections" name="ipc_sections"
                            value={verificationData.ipc_sections} onChange={handleVerificationChange}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Status & Findings ────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; Findings</Typography>
                      </Box>
                      <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Check Status</InputLabel>
                            <Select name="chargesheet_check_status" value={verificationData.chargesheet_check_status}
                              onChange={handleVerificationChange} label="Check Status" sx={{ borderRadius: '8px' }}>
                              <MenuItem value="Not Initiated">Not Initiated</MenuItem>
                              <MenuItem value="WIP">WIP</MenuItem>
                              <MenuItem value="Completed">Completed</MenuItem>
                              <MenuItem value="Stop">Stop</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Statement" name="chargesheet_statement"
                            value={verificationData.chargesheet_statement} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField fullWidth size="small" label="Observations" name="chargesheet_observations"
                            value={verificationData.chargesheet_observations} onChange={handleVerificationChange}
                            multiline rows={3} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                        </Grid>
                      </Grid>

                      <Divider sx={{ mb: 2.5 }} />

                      {/* ── Documents ────────────────────────────────────── */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>Documents</Typography>
                      </Box>
                      <Button variant="outlined" component="label" size="small" sx={{ borderRadius: '8px' }}>
                        Upload Documents
                        <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileSelect('chargesheet', e)} />
                      </Button>
                      {verificationFiles.chargesheet.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                          {verificationFiles.chargesheet.map((file, index) => (
                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                              <AttachFileIcon fontSize="small" color="action" />
                              <Typography variant="body2" sx={{ flex: 1 }}>{file.name}</Typography>
                              <IconButton size="small" color="error" onClick={() => handleRemoveFile('chargesheet', index)}><DeleteIcon fontSize="small" /></IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}

                    </Box>
                  </Card>
                )}
              </>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Case'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </AdminLayout>
  );
};

export default NewCasePage;
