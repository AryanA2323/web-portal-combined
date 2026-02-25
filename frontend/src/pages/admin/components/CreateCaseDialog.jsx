import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import api from '../../../services/api';

const CreateCaseDialog = ({ open, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'MACT',
    priority: 'MEDIUM',
    status: 'OPEN',
    claim_number: '',
    client_code: '',
    insured_name: '',
    claimant_name: '',
    incident_address: '',
    incident_city: '',
    incident_state: '',
    incident_postal_code: '',
    incident_country: 'India',
    latitude: '',
    longitude: '',
    client_id: '',
    vendor_id: '',
    source: 'MANUAL',
    workflow_type: 'STANDARD',
    chk_spot: false,
    chk_hospital: false,
    chk_claimant: false,
    chk_insured: false,
    chk_witness: false,
    chk_driver: false,
    chk_dl: false,
    chk_rc: false,
    chk_permit: false,
    chk_court: false,
    chk_notice: false,
    chk_134_notice: false,
    chk_rti: false,
    chk_medical_verification: false,
    chk_income: false,
  });

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    if (open) {
      // Fetch clients and vendors when dialog opens
      fetchClients();
      fetchVendors();
    }
  }, [open]);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data.clients || []);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await api.get('/vendors');
      setVendors(response.data.vendors || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Call the onSuccess callback with form data
      await onSuccess(formData);
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'MACT',
        priority: 'MEDIUM',
        status: 'OPEN',
        claim_number: '',
        client_code: '',
        insured_name: '',
        claimant_name: '',
        incident_address: '',
        incident_city: '',
        incident_state: '',
        incident_postal_code: '',
        incident_country: 'India',
        latitude: '',
        longitude: '',
        client_id: '',
        vendor_id: '',
        source: 'MANUAL',
        workflow_type: 'STANDARD',
        chk_spot: false,
        chk_hospital: false,
        chk_claimant: false,
        chk_insured: false,
        chk_witness: false,
        chk_driver: false,
        chk_dl: false,
        chk_rc: false,
        chk_permit: false,
        chk_court: false,
        chk_notice: false,
        chk_134_notice: false,
        chk_rti: false,
        chk_medical_verification: false,
        chk_income: false,
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to create case:', error);
      alert('Failed to create case. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Create New Case
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Case Title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                multiline
                rows={3}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  label="Category"
                >
                  <MenuItem value="MACT">Motor Accident Claims Tribunal</MenuItem>
                  <MenuItem value="CIVIL">Civil Case</MenuItem>
                  <MenuItem value="CRIMINAL">Criminal Case</MenuItem>
                  <MenuItem value="CONSUMER">Consumer Forum</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  label="Priority"
                >
                  <MenuItem value="LOW">Low</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  label="Status"
                >
                  <MenuItem value="OPEN">Open</MenuItem>
                  <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Insurance/Claim Details */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, mt: 2 }}>
                Insurance & Claim Details
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Claim Number"
                name="claim_number"
                value={formData.claim_number}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Client Code"
                name="client_code"
                value={formData.client_code}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insured Name"
                name="insured_name"
                value={formData.insured_name}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Claimant Name"
                name="claimant_name"
                value={formData.claimant_name}
                onChange={handleChange}
              />
            </Grid>

            {/* Location Details */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, mt: 2 }}>
                Incident Location
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Incident Address"
                name="incident_address"
                value={formData.incident_address}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="City"
                name="incident_city"
                value={formData.incident_city}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="State"
                name="incident_state"
                value={formData.incident_state}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Postal Code"
                name="incident_postal_code"
                value={formData.incident_postal_code}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Latitude"
                name="latitude"
                type="number"
                value={formData.latitude}
                onChange={handleChange}
                inputProps={{ step: 'any' }}
                helperText="Optional: For auto-vendor assignment"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Longitude"
                name="longitude"
                type="number"
                value={formData.longitude}
                onChange={handleChange}
                inputProps={{ step: 'any' }}
                helperText="Optional: For auto-vendor assignment"
              />
            </Grid>

            {/* Assignment */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, mt: 2 }}>
                Assignment
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Client</InputLabel>
                <Select
                  name="client_id"
                  value={formData.client_id}
                  onChange={handleChange}
                  label="Client"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.client_name} ({client.client_code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Assign Vendor</InputLabel>
                <Select
                  name="vendor_id"
                  value={formData.vendor_id}
                  onChange={handleChange}
                  label="Assign Vendor"
                >
                  <MenuItem value="">
                    <em>Not Assigned</em>
                  </MenuItem>
                  {vendors.map((vendor) => (
                    <MenuItem key={vendor.id} value={vendor.id}>
                      {vendor.company_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Workflow Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, mt: 2 }}>
                Workflow Information
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  label="Source"
                >
                  <MenuItem value="EMAIL">Email</MenuItem>
                  <MenuItem value="MANUAL">Manual Entry</MenuItem>
                  <MenuItem value="WEB_PORTAL">Web Portal</MenuItem>
                  <MenuItem value="API">API</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Workflow Type</InputLabel>
                <Select
                  name="workflow_type"
                  value={formData.workflow_type}
                  onChange={handleChange}
                  label="Workflow Type"
                >
                  <MenuItem value="STANDARD">Standard Investigation</MenuItem>
                  <MenuItem value="EXPEDITED">Expedited</MenuItem>
                  <MenuItem value="FULL">Full Investigation</MenuItem>
                  <MenuItem value="PARTIAL">Partial Investigation</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Verification Checklist */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Verification Checklist (Optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Select investigation tasks to be completed
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_spot}
                    onChange={handleChange}
                    name="chk_spot"
                  />
                }
                label="Spot Investigation"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_hospital}
                    onChange={handleChange}
                    name="chk_hospital"
                  />
                }
                label="Hospital Verification"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_claimant}
                    onChange={handleChange}
                    name="chk_claimant"
                  />
                }
                label="Claimant Verification"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_insured}
                    onChange={handleChange}
                    name="chk_insured"
                  />
                }
                label="Insured Verification"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_witness}
                    onChange={handleChange}
                    name="chk_witness"
                  />
                }
                label="Witness Statement"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_driver}
                    onChange={handleChange}
                    name="chk_driver"
                  />
                }
                label="Driver Verification"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_dl}
                    onChange={handleChange}
                    name="chk_dl"
                  />
                }
                label="Driving License"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_rc}
                    onChange={handleChange}
                    name="chk_rc"
                  />
                }
                label="RC Verification"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_permit}
                    onChange={handleChange}
                    name="chk_permit"
                  />
                }
                label="Permit Verification"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_court}
                    onChange={handleChange}
                    name="chk_court"
                  />
                }
                label="Court Records"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_notice}
                    onChange={handleChange}
                    name="chk_notice"
                  />
                }
                label="Notice Verification"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_134_notice}
                    onChange={handleChange}
                    name="chk_134_notice"
                  />
                }
                label="Section 134 Notice"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_rti}
                    onChange={handleChange}
                    name="chk_rti"
                  />
                }
                label="RTI Filed"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_medical_verification}
                    onChange={handleChange}
                    name="chk_medical_verification"
                  />
                }
                label="Medical Records"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.chk_income}
                    onChange={handleChange}
                    name="chk_income"
                  />
                }
                label="Income Verification"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.title}
          sx={{
            backgroundColor: '#667eea',
            '&:hover': { backgroundColor: '#5568d3' },
          }}
        >
          {loading ? 'Creating...' : 'Create Case'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateCaseDialog;
