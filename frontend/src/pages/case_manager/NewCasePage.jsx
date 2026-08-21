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
  Chip,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  Save,
  ArrowBack,
  Add as AddIcon,
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import CaseManagerLayout from './components/CaseManagerLayout';
import api from '../../services/api';
import AlertMessage from '../../components/common/AlertMessage';
import { NotificationBell } from '../../components/case_manager';

const NewCasePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getInvestigationTypeTatDays = (caseType) => {
    if (caseType === 'Full Case') return 30;
    if (caseType === 'Partial Case') return 15;
    if (caseType === 'Reassessment') return 15;
    return null;
  };

  // ===================== Common Case Fields (top section) =====================
  const [commonFields, setCommonFields] = useState({
    claim_number: '',
    client_name: '',
    category: 'MACT',
    case_receive_date: '',
    receive_month: '',
    closure_date: '',
    closure_month: '',
    case_due_date: '',
    tat_days: '',
    sla_status: '',
    investigation_type: 'Full Case',
    investigation_report_status: 'Open',
    full_case_status: 'WIP',
    special_instructions: '',
  });

  // Auto-compute receive_month when case_receive_date changes
  useEffect(() => {
    if (commonFields.case_receive_date) {
      const d = new Date(commonFields.case_receive_date);
      const month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      setCommonFields(prev => ({ ...prev, receive_month: month }));
    }
  }, [commonFields.case_receive_date]);

  // Auto-compute case_due_date = receive_date + TAT days
  useEffect(() => {
    if (commonFields.case_receive_date) {
      const tatDays = getInvestigationTypeTatDays(commonFields.investigation_type) || 30;
      const d = new Date(commonFields.case_receive_date);
      d.setDate(d.getDate() + tatDays);
      const due = d.toISOString().split('T')[0];
      setCommonFields(prev => ({ ...prev, case_due_date: due }));
    }
  }, [commonFields.case_receive_date, commonFields.investigation_type]);

  // Auto-populate TAT days based on investigation type when no closure date
  useEffect(() => {
    const tatDays = getInvestigationTypeTatDays(commonFields.investigation_type);
    if (!tatDays || commonFields.closure_date) {
      return;
    }
    setCommonFields(prev => ({ ...prev, tat_days: tatDays.toString() }));
  }, [commonFields.investigation_type, commonFields.closure_date]);

  // Auto-compute SLA: AT (Above TAT) if past due date, else WT (Within TAT)
  useEffect(() => {
    if (commonFields.case_due_date) {
      const due = new Date(commonFields.case_due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      setCommonFields(prev => ({ ...prev, sla_status: today > due ? 'AT' : 'WT' }));
    }
  }, [commonFields.case_due_date]);

  // Auto-compute closure_month when closure_date changes
  useEffect(() => {
    if (commonFields.closure_date) {
      const d = new Date(commonFields.closure_date);
      const month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      setCommonFields(prev => ({ ...prev, closure_month: month }));
    }
  }, [commonFields.closure_date]);

  // Auto-compute TAT when both receipt and closure dates exist
  useEffect(() => {
    if (commonFields.case_receive_date && commonFields.closure_date) {
      const start = new Date(commonFields.case_receive_date);
      const end = new Date(commonFields.closure_date);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      setCommonFields(prev => ({ ...prev, tat_days: diff >= 0 ? diff.toString() : '' }));
    }
  }, [commonFields.case_receive_date, commonFields.closure_date]);

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
    rto: false,
  });

  // File uploads for each verification type
  const [caseFiles, setCaseFiles] = useState({ policy: [], petition: [], other: [] });
  const [verificationFiles, setVerificationFiles] = useState({
    claimant: [],
    insured: [],
    driver: [],
    spot: [],
    chargesheet: [],
    rto: [],
  });

  // Verification-specific data
  const [verificationData, setVerificationData] = useState({
    // Per-verification-type common fields (each type gets own status/statement/observations)
    claimant_check_status: 'WIP',
    claimant_statement: '',
    claimant_triggers: '',
    insured_check_status: 'WIP',
    insured_statement: '',
    insured_triggers: '',
    driver_check_status: 'WIP',
    driver_statement: '',
    driver_triggers: '',
    spot_check_status: 'WIP',
    spot_statement: '',
    spot_triggers: '',
    chargesheet_check_status: 'WIP',
    chargesheet_statement: '',
    chargesheet_triggers: '',

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
    spot_city: '',
    police_station: '',
    accident_brief: '',

    // Chargesheet fields
    chargesheet_city: '',
    police_station_name: '',
    court_district: '',
    court_case_no: '',
    fir_delay_in_days: '',
    bsn_sections: '',
    ipc_sections: '',

    // RTO fields
    rto_check_status: 'WIP',
    rto_remarks: '',
    rto_name: '',
    rto_address: '',
    rto_dl_checked: false,
    rto_dl_number: '',
    rto_permit_checked: false,
    rto_permit_number: '',
    rto_rc_checked: false,
    rto_rc_number: '',
  });

  // Client list for dropdown
  const [clientsList, setClientsList] = useState([]);

  // Court details dropdown options
  const [courtCities, setCourtCities] = useState([]);
  const [spotPoliceStations, setSpotPoliceStations] = useState([]);
  const [chargesheetCourts, setChargesheetCourts] = useState([]);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get('/clients');
        setClientsList(res.data || []);
      } catch (err) {
        console.error('Failed to fetch clients:', err);
      }
    };
    fetchClients();
  }, []);

  // Fetch cities on mount
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await api.get('/court-details/cities');
        setCourtCities(res.data.cities || []);
      } catch (err) {
        console.error('Failed to fetch cities:', err);
      }
    };
    fetchCities();
  }, []);

  // Fetch police stations when spot city changes
  useEffect(() => {
    if (!verificationData.spot_city) { setSpotPoliceStations([]); return; }
    const fetchStations = async () => {
      try {
        const res = await api.get(`/court-details/police-stations?city=${encodeURIComponent(verificationData.spot_city)}`);
        setSpotPoliceStations(res.data.police_stations || []);
      } catch (err) {
        console.error('Failed to fetch police stations:', err);
      }
    };
    fetchStations();
  }, [verificationData.spot_city]);

  // Fetch courts when chargesheet city changes
  useEffect(() => {
    if (!verificationData.chargesheet_city) { setChargesheetCourts([]); return; }
    const fetchCourts = async () => {
      try {
        const res = await api.get(`/court-details/courts?city=${encodeURIComponent(verificationData.chargesheet_city)}`);
        setChargesheetCourts(res.data.courts || []);
      } catch (err) {
        console.error('Failed to fetch courts:', err);
      }
    };
    fetchCourts();
  }, [verificationData.chargesheet_city]);

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
    setVerificationData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      if (name === 'driver_same_as_insured' && checked) {
        newData.driver_name = newData.insured_name || '';
        newData.driver_contact = newData.insured_contact || '';
        newData.driver_address = newData.insured_address || '';
      }

      return newData;
    });
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
  const handleCaseFileSelect = (e, type) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setCaseFiles(prev => ({ ...prev, [type]: [...prev[type], ...newFiles] }));
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleRemoveCaseFile = (type, index) => {
    setCaseFiles(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  };

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
      const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

      // Validate required common fields
      if (isBlank(commonFields.claim_number)) {
        setError('Claim Number is required');
        setLoading(false);
        return;
      }
      if (isBlank(commonFields.client_name)) {
        setError('Client Name is required');
        setLoading(false);
        return;
      }
      if (isBlank(commonFields.case_receive_date)) {
        setError('Receive Date is required');
        setLoading(false);
        return;
      }
      if (isBlank(commonFields.investigation_type)) {
        setError('Investigation Type is required');
        setLoading(false);
        return;
      }
      if (isBlank(commonFields.special_instructions)) {
        setError('Special Instructions is required');
        setLoading(false);
        return;
      }

      if (selectedVerifications.claimant) {
        if (isBlank(verificationData.claimant_name)) {
          setError('Claimant Name is required for Claimant Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.claimant_address)) {
          setError('Claimant Address is required for Claimant Check');
          setLoading(false);
          return;
        }
      }

      if (selectedVerifications.insured) {
        if (isBlank(verificationData.insured_name)) {
          setError('Insured Name is required for Insured Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.insured_address)) {
          setError('Insured Address is required for Insured Check');
          setLoading(false);
          return;
        }

      }

      if (selectedVerifications.driver) {
        if (isBlank(verificationData.driver_name)) {
          setError('Driver Name is required for Driver Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.driver_address)) {
          setError('Driver Address is required for Driver Check');
          setLoading(false);
          return;
        }

      }

      if (selectedVerifications.spot) {
        if (isBlank(verificationData.time_of_accident)) {
          setError('Time of Accident is required for Spot Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.place_of_accident)) {
          setError('Place of Accident is required for Spot Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.district)) {
          setError('District is required for Spot Check');
          setLoading(false);
          return;
        }

        if (isBlank(verificationData.spot_city)) {
          setError('City is required for Spot Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.police_station)) {
          setError('Police Station is required for Spot Check');
          setLoading(false);
          return;
        }
      }

      if (selectedVerifications.chargesheet) {
        if (isBlank(verificationData.fir_number_claimant)) {
          setError('FIR Number is required for Chargesheet Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.chargesheet_city)) {
          setError('City is required for Chargesheet Check');
          setLoading(false);
          return;
        }
        if (isBlank(verificationData.court_name)) {
          setError('Court Name is required for Chargesheet Check');
          setLoading(false);
          return;
        }

      }

      // Build the case payload from common fields
      const payload = {
        // Common fields
        claim_number: commonFields.claim_number,
        client_name: commonFields.client_name,
        category: commonFields.category,
        case_receive_date: commonFields.case_receive_date || null,
        receive_month: commonFields.receive_month,
        closure_date: commonFields.closure_date || null,
        closure_month: commonFields.closure_month,
        case_due_date: commonFields.case_due_date || null,
        tat_days: commonFields.tat_days ? parseInt(commonFields.tat_days) : null,
        sla_status: commonFields.sla_status,
        investigation_type: commonFields.investigation_type,
        investigation_report_status: commonFields.investigation_report_status,
        full_case_status: commonFields.full_case_status,
        special_instructions: commonFields.special_instructions,
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
      const caseId = response.data.insurance_case_id || response.data.id;
      const incidentCaseDbId = response.data.incident_case_db_id;

      // Upload case documents if any
      if (caseFiles.policy.length > 0 || caseFiles.petition.length > 0 || caseFiles.other.length > 0) {
        const formData = new FormData();
        caseFiles.policy.forEach(f => formData.append('policy', f));
        caseFiles.petition.forEach(f => formData.append('petition', f));
        caseFiles.other.forEach(f => formData.append('other', f));
        try {
          await api.post(`/cases/${incidentCaseDbId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (uploadError) {
          console.error('Failed to upload case documents:', uploadError);
        }
      }

      // Create verification records only for selected types
      const verificationsToCreate = [];

      if (selectedVerifications.claimant) {
        verificationsToCreate.push({
          case_id: caseId,
          incident_case_db_id: incidentCaseDbId,
          check_type: 'CLAIMANT',
          check_status: verificationData.claimant_check_status || 'WIP',
          statement: verificationData.claimant_statement,
          triggers: verificationData.claimant_triggers,
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
          triggers: verificationData.insured_triggers,
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
          triggers: verificationData.driver_triggers,
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
          triggers: verificationData.spot_triggers,
          time_of_accident: verificationData.time_of_accident,
          place_of_accident: verificationData.place_of_accident,
          district: verificationData.district,
          fir_number_spot: verificationData.fir_number_spot,
          spot_city: verificationData.spot_city,
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
          triggers: verificationData.chargesheet_triggers,
          fir_number_claimant: verificationData.fir_number_claimant,
          chargesheet_city: verificationData.chargesheet_city,
          court_name: verificationData.court_name,
          mv_act: verificationData.mv_act,
          police_station_name: verificationData.police_station_name,
          court_district: verificationData.court_district,
          court_case_no: verificationData.court_case_no,
          fir_delay_in_days: verificationData.fir_delay_in_days ? parseInt(verificationData.fir_delay_in_days) : null,
          bsn_sections: verificationData.bsn_sections,
          ipc_sections: verificationData.ipc_sections,
        });
      }

      if (selectedVerifications.rto) {
        verificationsToCreate.push({
          case_id: caseId,
          incident_case_db_id: incidentCaseDbId,
          check_type: 'RTO',
          check_status: verificationData.rto_check_status || 'WIP',
          rto_name: verificationData.rto_name,
          rto_address: verificationData.rto_address,
          rto_dl_checked: verificationData.rto_dl_checked,
          rto_dl_number: verificationData.rto_dl_number,
          rto_permit_checked: verificationData.rto_permit_checked,
          rto_permit_number: verificationData.rto_permit_number,
          rto_rc_checked: verificationData.rto_rc_checked,
          rto_rc_number: verificationData.rto_rc_number,
          rto_remarks: verificationData.rto_remarks,
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
        navigate('/case_manager/cases');
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
    navigate('/case_manager/cases');
  };

  return (
    <CaseManagerLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, borderBottom: '1px solid #e0e0e0', pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4">
            Create Verification Case
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={handleCancel}
              variant="outlined"
            >
              Back to Cases
            </Button>
            <NotificationBell />
          </Box>
        </Box>

        {/* Error/Success Messages */}
        {error && (
          <AlertMessage severity="error" onClose={() => setError('')} message={error} open={!!error} />
        )}
        {success && (
          <AlertMessage severity="success" onClose={() => setSuccess('')} message={success} open={!!success} />
        )}

        {/* Form */}
        <Paper sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          '& .MuiInputLabel-asterisk': { color: '#ef4444' },
          '& .required-placeholder': { color: '#ef4444' },
        }}>
          <form onSubmit={handleSubmit}>
            {/* ========== COMMON CASE FIELDS (TOP SECTION) ========== */}
            <Card
              elevation={0}
              sx={{
                mb: 4,
                overflow: 'hidden',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Header Banner */}
              <Box
                sx={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: 'white',
                  px: 3,
                  py: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight="700" sx={{ letterSpacing: '0.2px' }}>
                    Case Information
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85, fontSize: '0.825rem' }}>
                    Primary case identification, timeline parameters, and document attachments
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ p: { xs: 2.5, sm: 3 } }}>

                {/* ── Section 1: General Information ─────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2563eb' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    1. General Information
                  </Typography>
                </Box>
                
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: '1.2fr 2.4fr 1.2fr 1fr',
                    },
                    gap: 2.5,
                    mb: 3.5,
                    width: '100%',
                  }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    label="Claim Number"
                    name="claim_number"
                    value={commonFields.claim_number}
                    onChange={handleCommonFieldChange}
                    required
                    placeholder="e.g. CLM-2024-001"
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                    }}
                  />

                  <FormControl fullWidth size="small" required>
                    <InputLabel id="client-name-label">Client Name</InputLabel>
                    <Select
                      labelId="client-name-label"
                      label="Client Name"
                      name="client_name"
                      value={commonFields.client_name}
                      onChange={handleCommonFieldChange}
                      sx={{ borderRadius: '8px' }}
                    >
                      <MenuItem value=""><em>Select Client</em></MenuItem>
                      {clientsList.map((client) => (
                        <MenuItem key={client.id} value={`${client.client_name} – ${client.client_code}`}>
                          {client.client_name} – {client.client_code}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small" required>
                    <InputLabel id="investigation-type-label">Investigation Type</InputLabel>
                    <Select
                      labelId="investigation-type-label"
                      label="Investigation Type"
                      name="investigation_type"
                      value={commonFields.investigation_type}
                      onChange={handleCommonFieldChange}
                      sx={{ borderRadius: '8px' }}
                    >
                      <MenuItem value="Full Case">Full Case</MenuItem>
                      <MenuItem value="Partial Case">Partial Case</MenuItem>
                      <MenuItem value="Reassessment">Reassessment</MenuItem>
                      <MenuItem value="Connected Case">Connected Case</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <InputLabel id="category-label">Category</InputLabel>
                    <Select
                      labelId="category-label"
                      label="Category"
                      name="category"
                      value={commonFields.category}
                      onChange={handleCommonFieldChange}
                      sx={{ borderRadius: '8px' }}
                    >
                      <MenuItem value="MACT">MACT</MenuItem>
                      <MenuItem value="Health">Health</MenuItem>
                      <MenuItem value="Theft">Theft</MenuItem>
                      <MenuItem value="OD">OD</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Divider sx={{ mb: 3, borderColor: '#e2e8f0' }} />

                {/* ── Section 2: Timeline & Turnaround Schedule ─────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
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
                    mb: 3.5,
                    width: '100%',
                  }}
                >
                  {/* Intake Column */}
                  <Box sx={{ p: 2, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
                      Case Intake
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Receive Date"
                        name="case_receive_date"
                        type="date"
                        value={commonFields.case_receive_date}
                        onChange={handleCommonFieldChange}
                        required
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#ffffff' } }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Receive Month (Auto)"
                        name="receive_month"
                        value={commonFields.receive_month}
                        InputProps={{ readOnly: true }}
                        placeholder="Auto-filled from receive date"
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f1f5f9' },
                          '& .MuiInputBase-input': { color: '#334155', fontWeight: 500 }
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Completion Column */}
                  <Box sx={{ p: 2, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
                      Case Completion
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Closure Date"
                        name="closure_date"
                        type="date"
                        value={commonFields.closure_date}
                        onChange={handleCommonFieldChange}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#ffffff' } }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Closure Month (Auto)"
                        name="closure_month"
                        value={commonFields.closure_month}
                        InputProps={{ readOnly: true }}
                        placeholder="Auto-filled from closure date"
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f1f5f9' },
                          '& .MuiInputBase-input': { color: '#334155', fontWeight: 500 }
                        }}
                      />
                    </Box>
                  </Box>

                  {/* SLA & TAT Column */}
                  <Box sx={{ p: 2, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
                      SLA &amp; Turnaround (TAT)
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Case Due Date (Auto)"
                        name="case_due_date"
                        type="date"
                        value={commonFields.case_due_date}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{ readOnly: true }}
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f1f5f9' },
                          '& .MuiInputBase-input': { color: '#334155', fontWeight: 500 }
                        }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="TAT Days (Auto)"
                        name="tat_days"
                        type="number"
                        value={commonFields.tat_days}
                        InputProps={{ readOnly: true }}
                        placeholder="Calculated turnaround days"
                        sx={{
                          '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f1f5f9' },
                          '& .MuiInputBase-input': { color: '#334155', fontWeight: 500 }
                        }}
                      />
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ mb: 3, borderColor: '#e2e8f0' }} />

                {/* ── Section 3: Reference Document Uploads ─────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#d97706' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    3. Case Documents (Optional)
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
                    width: '100%',
                  }}
                >
                  {[
                    { key: 'policy', label: 'Policy Document', helper: 'Upload insurance policy copy' },
                    { key: 'petition', label: 'Petition Document', helper: 'Upload claim petition or legal copy' },
                    { key: 'other', label: 'Other Documents', helper: 'Any supporting case files' },
                  ].map(({ key, label, helper }) => (
                    <Box
                      key={key}
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        border: caseFiles[key].length > 0 ? '1.5px solid #16a34a' : '1px dashed #cbd5e1',
                        bgcolor: caseFiles[key].length > 0 ? '#f0fdf4' : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.25,
                        minHeight: '130px',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: caseFiles[key].length > 0 ? '#15803d' : '#1e293b' }}>
                          {label}
                        </Typography>
                        {caseFiles[key].length > 0 && (
                          <Chip
                            label={`${caseFiles[key].length} file${caseFiles[key].length > 1 ? 's' : ''}`}
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 }}
                          />
                        )}
                      </Box>

                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                        {helper}
                      </Typography>

                      <Button
                        variant="outlined"
                        component="label"
                        size="small"
                        startIcon={<AttachFileIcon sx={{ fontSize: '1rem' }} />}
                        fullWidth
                        sx={{
                          mt: 'auto',
                          height: '36px',
                          borderRadius: '6px',
                          border: caseFiles[key].length > 0 ? '1px solid #16a34a' : '1px solid #cbd5e1',
                          bgcolor: '#ffffff',
                          color: caseFiles[key].length > 0 ? '#15803d' : '#334155',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          '&:hover': {
                            borderColor: '#2563eb',
                            bgcolor: '#eff6ff',
                          },
                        }}
                      >
                        Browse Files
                        <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleCaseFileSelect(e, key)} />
                      </Button>

                      {caseFiles[key].length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                          {caseFiles[key].map((file, idx) => (
                            <Chip
                              key={idx}
                              label={file.name}
                              size="small"
                              onDelete={() => handleRemoveCaseFile(key, idx)}
                              deleteIcon={<CloseIcon sx={{ fontSize: '14px !important' }} />}
                              sx={{
                                maxWidth: '100%',
                                bgcolor: '#ffffff',
                                border: '1px solid #bbf7d0',
                                color: '#166534',
                                fontWeight: 600,
                                fontSize: '0.725rem',
                                '& .MuiChip-deleteIcon': { color: '#dc2626', '&:hover': { color: '#b91c1c' } },
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>

              </Box>
            </Card>

            {/* ========== VERIFICATION TYPE SELECTION ========== */}
            <Typography variant="h6" gutterBottom sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
              Required Verifications
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select the verification checks required for this case. Fields for selected verifications will appear below.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(6, 1fr)',
                },
                gap: 1.5,
                width: '100%',
                mb: 4,
              }}
            >
              {/* Claimant */}
              <Card
                elevation={selectedVerifications.claimant ? 3 : 1}
                sx={{
                  p: 1.25,
                  cursor: 'pointer',
                  border: selectedVerifications.claimant ? '2px solid #1976d2' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  bgcolor: selectedVerifications.claimant ? '#f0f7ff' : '#ffffff',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                }}
                onClick={() => setSelectedVerifications(prev => ({ ...prev, claimant: !prev.claimant }))}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="claimant"
                      checked={selectedVerifications.claimant}
                      onChange={(e) => setSelectedVerifications(prev => ({ ...prev, claimant: e.target.checked }))}
                      color="primary"
                      size="small"
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: selectedVerifications.claimant ? '#1565c0' : '#334155' }}>
                      Claimant
                    </Typography>
                  }
                  sx={{ m: 0, width: '100%', userSelect: 'none', justifyContent: 'center' }}
                />
              </Card>

              {/* Insured */}
              <Card
                elevation={selectedVerifications.insured ? 3 : 1}
                sx={{
                  p: 1.25,
                  cursor: 'pointer',
                  border: selectedVerifications.insured ? '2px solid #2e7d32' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  bgcolor: selectedVerifications.insured ? '#f0fdf4' : '#ffffff',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                }}
                onClick={() => setSelectedVerifications(prev => ({ ...prev, insured: !prev.insured }))}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="insured"
                      checked={selectedVerifications.insured}
                      onChange={(e) => setSelectedVerifications(prev => ({ ...prev, insured: e.target.checked }))}
                      color="success"
                      size="small"
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: selectedVerifications.insured ? '#166534' : '#334155' }}>
                      Insured
                    </Typography>
                  }
                  sx={{ m: 0, width: '100%', userSelect: 'none', justifyContent: 'center' }}
                />
              </Card>

              {/* Driver */}
              <Card
                elevation={selectedVerifications.driver ? 3 : 1}
                sx={{
                  p: 1.25,
                  cursor: 'pointer',
                  border: selectedVerifications.driver ? '2px solid #ed6c02' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  bgcolor: selectedVerifications.driver ? '#fffbeb' : '#ffffff',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                }}
                onClick={() => setSelectedVerifications(prev => ({ ...prev, driver: !prev.driver }))}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="driver"
                      checked={selectedVerifications.driver}
                      onChange={(e) => setSelectedVerifications(prev => ({ ...prev, driver: e.target.checked }))}
                      color="warning"
                      size="small"
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: selectedVerifications.driver ? '#b45309' : '#334155' }}>
                      Driver
                    </Typography>
                  }
                  sx={{ m: 0, width: '100%', userSelect: 'none', justifyContent: 'center' }}
                />
              </Card>

              {/* Spot */}
              <Card
                elevation={selectedVerifications.spot ? 3 : 1}
                sx={{
                  p: 1.25,
                  cursor: 'pointer',
                  border: selectedVerifications.spot ? '2px solid #9c27b0' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  bgcolor: selectedVerifications.spot ? '#faf5ff' : '#ffffff',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                }}
                onClick={() => setSelectedVerifications(prev => ({ ...prev, spot: !prev.spot }))}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="spot"
                      checked={selectedVerifications.spot}
                      onChange={(e) => setSelectedVerifications(prev => ({ ...prev, spot: e.target.checked }))}
                      color="secondary"
                      size="small"
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: selectedVerifications.spot ? '#7e22ce' : '#334155' }}>
                      Spot
                    </Typography>
                  }
                  sx={{ m: 0, width: '100%', userSelect: 'none', justifyContent: 'center' }}
                />
              </Card>

              {/* Chargesheet */}
              <Card
                elevation={selectedVerifications.chargesheet ? 3 : 1}
                sx={{
                  p: 1.25,
                  cursor: 'pointer',
                  border: selectedVerifications.chargesheet ? '2px solid #d32f2f' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  bgcolor: selectedVerifications.chargesheet ? '#fef2f2' : '#ffffff',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                }}
                onClick={() => setSelectedVerifications(prev => ({ ...prev, chargesheet: !prev.chargesheet }))}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="chargesheet"
                      checked={selectedVerifications.chargesheet}
                      onChange={(e) => setSelectedVerifications(prev => ({ ...prev, chargesheet: e.target.checked }))}
                      color="error"
                      size="small"
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: selectedVerifications.chargesheet ? '#b91c1c' : '#334155' }}>
                      Chargesheet
                    </Typography>
                  }
                  sx={{ m: 0, width: '100%', userSelect: 'none', justifyContent: 'center' }}
                />
              </Card>

              {/* RTO */}
              <Card
                elevation={selectedVerifications.rto ? 3 : 1}
                sx={{
                  p: 1.25,
                  cursor: 'pointer',
                  border: selectedVerifications.rto ? '2px solid #4527a0' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  bgcolor: selectedVerifications.rto ? '#f5f3ff' : '#ffffff',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  '&:hover': { elevation: 3, transform: 'translateY(-2px)' }
                }}
                onClick={() => setSelectedVerifications(prev => ({ ...prev, rto: !prev.rto }))}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="rto"
                      checked={selectedVerifications.rto}
                      onChange={(e) => setSelectedVerifications(prev => ({ ...prev, rto: e.target.checked }))}
                      sx={{ color: '#4527a0', '&.Mui-checked': { color: '#4527a0' }, p: 0.5 }}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 700, color: selectedVerifications.rto ? '#4527a0' : '#334155' }}>
                      RTO
                    </Typography>
                  }
                  sx={{ m: 0, width: '100%', userSelect: 'none', justifyContent: 'center' }}
                />
              </Card>
            </Box>

            {/* Show verification fields only if at least one verification is selected */}
            {(selectedVerifications.claimant || selectedVerifications.insured ||
              selectedVerifications.driver || selectedVerifications.spot ||
              selectedVerifications.chargesheet ||
              selectedVerifications.rto) && (
                <>
                  <Divider sx={{ my: 4 }} />

                  {/* Claimant Details Fields */}
                  {selectedVerifications.claimant && (
                    <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                      <Box sx={{ bgcolor: '#1976d2', color: 'white', p: 2 }}>
                        <Typography variant="h6" fontWeight="600">Claimant Details</Typography>
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
                              required
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
                              required
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
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; triggers</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2.5, width: '100%', mb: 3, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Statement" name="claimant_statement"
                              value={verificationData.claimant_statement} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This field will be filled by the vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Triggers" name="claimant_triggers"
                              value={verificationData.claimant_triggers} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This is the trigger note for vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                        </Box>

                      </Box>
                    </Card>
                  )}

                  {/* Insured Details Fields */}
                  {selectedVerifications.insured && (
                    <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                      <Box sx={{ bgcolor: '#2e7d32', color: 'white', p: 2 }}>
                        <Typography variant="h6" fontWeight="600">Insured Details</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>Personal details, policy &amp; vehicle information</Typography>
                      </Box>
                      <Box sx={{ p: 3 }}>

                        {/* ── Personal Details ─────────────────────────────── */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#2e7d32' }} />
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#2e7d32', letterSpacing: '1px', lineHeight: 1 }}>Personal Details</Typography>
                        </Box>
                        <FormControlLabel
                          control={<Checkbox checked={verificationData.driver_and_insured_same || false} onChange={(e) => {
                            handleVerificationChange({ target: { name: 'driver_and_insured_same', value: e.target.checked } });
                            handleVerificationChange({ target: { name: 'insured_cum_driver', value: e.target.checked } });
                          }} name="driver_and_insured_same" sx={{ '&.Mui-checked': { color: '#2e7d32' } }} />}
                          label="Insured is same as Driver"
                          sx={{ mb: 2 }}
                        />
                        <Grid container spacing={2.5} sx={{ mb: 3 }}>
                          <Grid item xs={12} sm={4}>
                            <TextField fullWidth size="small" label="Insured Name" name="insured_name"
                              value={verificationData.insured_name} onChange={handleVerificationChange}
                              required
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
                              required
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
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; triggers</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2.5, width: '100%', mb: 3, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Statement" name="insured_statement"
                              value={verificationData.insured_statement} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This field will be filled by the vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Triggers" name="insured_triggers"
                              value={verificationData.insured_triggers} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This is the trigger note for vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                        </Box>

                      </Box>
                    </Card>
                  )}

                  {/* Driver Details Fields */}
                  {selectedVerifications.driver && (
                    <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                      <Box sx={{ bgcolor: '#ed6c02', color: 'white', p: 2 }}>
                        <Typography variant="h6" fontWeight="600">Driver Details</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>Personal details, license &amp; vehicle permit</Typography>
                      </Box>
                      <Box sx={{ p: 3 }}>

                        {/* ── Personal Details ─────────────────────────────── */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#ed6c02' }} />
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#ed6c02', letterSpacing: '1px', lineHeight: 1 }}>Personal Details</Typography>
                        </Box>
                        <FormControlLabel
                          control={<Checkbox checked={verificationData.driver_and_insured_same || false} onChange={(e) => {
                            handleVerificationChange({ target: { name: 'driver_and_insured_same', value: e.target.checked } });
                            handleVerificationChange({ target: { name: 'insured_cum_driver', value: e.target.checked } });
                          }} name="driver_and_insured_same" sx={{ '&.Mui-checked': { color: '#6a1b9a' } }} />}
                          label="Driver is same as Insured"
                          sx={{ mb: 2 }}
                        />
                        <Grid container spacing={2.5} sx={{ mb: 3 }}>
                          <Grid item xs={12} sm={4}>
                            <TextField fullWidth size="small" label="Driver Name" name="driver_name"
                              value={verificationData.driver_name} onChange={handleVerificationChange}
                              required
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
                              required
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
                        </Grid>

                        <Divider sx={{ mb: 2.5 }} />

                        {/* ── Status & Findings ────────────────────────────── */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; triggers</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2.5, width: '100%', mb: 3, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Statement" name="driver_statement"
                              value={verificationData.driver_statement} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This field will be filled by the vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Triggers" name="driver_triggers"
                              value={verificationData.driver_triggers} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This is the trigger note for vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                        </Box>

                      </Box>
                    </Card>
                  )}

                  {/* Spot Details Fields */}
                  {selectedVerifications.spot && (
                    <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                      <Box sx={{ bgcolor: '#9c27b0', color: 'white', p: 2 }}>
                        <Typography variant="h6" fontWeight="600">Spot Details</Typography>
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
                              required
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField fullWidth size="small" label="Place of Accident" name="place_of_accident"
                              value={verificationData.place_of_accident} onChange={handleVerificationChange}
                              required
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField fullWidth size="small" label="District" name="district"
                              value={verificationData.district} onChange={handleVerificationChange}
                              required
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
                          <Grid item xs={12} sm={6}>
                            <TextField fullWidth size="small" label="FIR Number" name="fir_number_spot"
                              value={verificationData.fir_number_spot} onChange={handleVerificationChange}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" required>
                              <Select name="spot_city" value={verificationData.spot_city}
                                displayEmpty
                                renderValue={(selected) => selected || <span className="required-placeholder">Select City</span>}
                                onChange={(e) => {
                                  handleVerificationChange(e);
                                  setVerificationData(prev => ({ ...prev, police_station: '' }));
                                }}
                                sx={{ borderRadius: '8px' }}>
                                <MenuItem value=""><em>Select City</em></MenuItem>
                                {courtCities.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" required>
                              <Select name="police_station" value={verificationData.police_station}
                                displayEmpty
                                renderValue={(selected) => selected || <span className="required-placeholder">Select Police Station</span>}
                                onChange={handleVerificationChange}
                                sx={{ borderRadius: '8px' }}
                                disabled={!verificationData.spot_city}>
                                <MenuItem value=""><em>Select Police Station</em></MenuItem>
                                {spotPoliceStations.map(ps => <MenuItem key={ps} value={ps}>{ps}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField fullWidth size="small" label="Accident Brief" name="accident_brief"
                              value={verificationData.accident_brief} onChange={handleVerificationChange}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                        </Grid>

                        <Divider sx={{ mb: 2.5 }} />

                        {/* ── Status & Findings ────────────────────────────── */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#6a1b9a' }} />
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; triggers</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2.5, width: '100%', mb: 3, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Statement" name="spot_statement"
                              value={verificationData.spot_statement} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This field will be filled by the vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Triggers" name="spot_triggers"
                              value={verificationData.spot_triggers} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This is the trigger note for vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                        </Box>

                      </Box>
                    </Card>
                  )}

                  {/* Chargesheet Details Fields */}
                  {selectedVerifications.chargesheet && (
                    <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                      <Box sx={{ bgcolor: '#d32f2f', color: 'white', p: 2 }}>
                        <Typography variant="h6" fontWeight="600">Chargesheet Details</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>Legal references, sections &amp; findings</Typography>
                      </Box>
                      <Box sx={{ p: 3 }}>

                        {/* ── Legal Reference ───────────────────────────────── */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#d32f2f' }} />
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#d32f2f', letterSpacing: '1px', lineHeight: 1 }}>Legal Reference</Typography>
                        </Box>
                        <Grid container spacing={2.5} sx={{ mb: 3 }}>
                          <Grid item xs={12} sm={6}>
                            <TextField fullWidth size="small" label="FIR Number" name="fir_number_claimant"
                              value={verificationData.fir_number_claimant} onChange={handleVerificationChange}
                              required
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" required>
                              <Select name="chargesheet_city" value={verificationData.chargesheet_city}
                                displayEmpty
                                renderValue={(selected) => selected || <span className="required-placeholder">Select City</span>}
                                onChange={(e) => {
                                  handleVerificationChange(e);
                                  setVerificationData(prev => ({ ...prev, court_name: '' }));
                                }}
                                sx={{ borderRadius: '8px' }}>
                                <MenuItem value=""><em>Select City</em></MenuItem>
                                {courtCities.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" required>
                              <Select name="court_name" value={verificationData.court_name}
                                displayEmpty
                                renderValue={(selected) => selected || <span className="required-placeholder">Select Court Name</span>}
                                onChange={handleVerificationChange}
                                sx={{ borderRadius: '8px' }}
                                disabled={!verificationData.chargesheet_city}>
                                <MenuItem value=""><em>Select Court</em></MenuItem>
                                {chargesheetCourts.map(ct => <MenuItem key={ct} value={ct}>{ct}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField fullWidth size="small" label="MV Act" name="mv_act"
                              value={verificationData.mv_act} onChange={handleVerificationChange}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField fullWidth size="small" label="Police Station Name" name="police_station_name"
                              value={verificationData.police_station_name} onChange={handleVerificationChange}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField fullWidth size="small" label="Court District" name="court_district"
                              value={verificationData.court_district} onChange={handleVerificationChange}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField fullWidth size="small" label="Court Case No" name="court_case_no"
                              value={verificationData.court_case_no} onChange={handleVerificationChange}
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
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#6a1b9a', letterSpacing: '1px', lineHeight: 1 }}>Status &amp; triggers</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2.5, width: '100%', mb: 3, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Statement" name="chargesheet_statement"
                              value={verificationData.chargesheet_statement} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This field will be filled by the vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextField fullWidth size="small" label="Triggers" name="chargesheet_triggers"
                              value={verificationData.chargesheet_triggers} onChange={handleVerificationChange}
                              multiline rows={3}
                              helperText="Note: This is the trigger note for vendor."
                              FormHelperTextProps={{ sx: { color: '#1976d2', fontWeight: 500 } }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Box>
                        </Box>

                      </Box>
                    </Card>
                  )}


                  {/* RTO Details Fields */}
                  {selectedVerifications.rto && (
                    <Card elevation={3} sx={{ mb: 4, overflow: 'hidden', borderRadius: 2 }}>
                      <Box sx={{ bgcolor: '#4527a0', color: 'white', p: 2 }}>
                        <Typography variant="h6" fontWeight="600">RTO Details</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>Regional Transport Office — verify documents at RTO</Typography>
                      </Box>
                      <Box sx={{ p: 3 }}>

                        {/* ── RTO Office Info ─────────────────────────────── */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#4527a0' }} />
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#4527a0', letterSpacing: '1px', lineHeight: 1 }}>RTO Office</Typography>
                        </Box>
                        <Grid container spacing={2.5} sx={{ mb: 3 }}>
                          <Grid item xs={12}>
                            <TextField fullWidth size="small" label="RTO Address" name="rto_address"
                              value={verificationData.rto_address || ''} onChange={handleVerificationChange}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
                          </Grid>
                        </Grid>

                        {/* ── Case Documents Upload ───────────────────────── */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: '#4527a0' }} />
                          <Typography variant="overline" sx={{ fontWeight: 700, color: '#4527a0', letterSpacing: '1px', lineHeight: 1 }}>Case Documents</Typography>
                        </Box>
                        
                        <Box sx={{ mb: 3 }}>
                          <Button
                            variant="outlined"
                            component="label"
                            startIcon={<UploadFileIcon />}
                            sx={{
                              width: 'fit-content',
                              px: 4,
                              height: '44px',
                              borderRadius: '8px',
                              border: verificationFiles.rto && verificationFiles.rto.length > 0 ? '1.5px solid #2e7d32' : '1.5px solid #4527a0',
                              bgcolor: verificationFiles.rto && verificationFiles.rto.length > 0 ? '#f0fdf4' : '#ffffff',
                              color: verificationFiles.rto && verificationFiles.rto.length > 0 ? '#166534' : '#4527a0',
                              textTransform: 'none',
                              fontWeight: 600,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                              '&:hover': {
                                borderColor: verificationFiles.rto && verificationFiles.rto.length > 0 ? '#1e40af' : '#311b92',
                                bgcolor: verificationFiles.rto && verificationFiles.rto.length > 0 ? '#dcfce7' : '#ede7f6',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                              },
                            }}
                          >
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              Upload Documents
                            </Typography>
                            <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileSelect('rto', e)} />
                          </Button>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-start', mt: 1.5 }}>
                            {verificationFiles.rto && verificationFiles.rto.length > 0 ? (
                              verificationFiles.rto.map((file, idx) => (
                                <Chip
                                  key={idx}
                                  label={file.name}
                                  size="small"
                                  onDelete={() => handleRemoveFile('rto', idx)}
                                  deleteIcon={<CloseIcon sx={{ fontSize: '14px !important' }} />}
                                  sx={{
                                    maxWidth: '200px',
                                    bgcolor: '#e8f5e9',
                                    color: '#1b5e20',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    '& .MuiChip-deleteIcon': { color: '#c62828', '&:hover': { color: '#b71c1c' } },
                                  }}
                                />
                              ))
                            ) : (
                              <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                No files selected
                              </Typography>
                            )}
                          </Box>
                        </Box>



                      </Box>
                    </Card>
                  )}
                </>
              )}

            {/* ========== SPECIAL INSTRUCTIONS ========== */}
            <Paper elevation={0} sx={{ mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fafafa' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box sx={{ width: 4, height: 20, borderRadius: 2, bgcolor: '#673ab7' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151' }}>
                  Special Instructions
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#6b7280', mb: 3, ml: 2 }}>
                Describe the scope of investigation work
              </Typography>
              <TextField
                fullWidth
                size="small"
                name="special_instructions"
                value={commonFields.special_instructions}
                onChange={handleCommonFieldChange}
                multiline
                rows={5}
                required
                placeholder="Describe the scope of investigation work..."
                sx={{
                  bgcolor: '#ffffff',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                  }
                }}
              />
            </Paper>

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

        {/* Loading Overlay */}
        <Dialog open={loading} PaperProps={{ sx: { backgroundColor: 'transparent', boxShadow: 'none' } }}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
            <CircularProgress size={60} sx={{ color: 'white', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Creating Case...
            </Typography>
          </DialogContent>
        </Dialog>
      </CaseManagerLayout>
  );
};

export default NewCasePage;
