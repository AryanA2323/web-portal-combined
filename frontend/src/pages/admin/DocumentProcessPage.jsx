import { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Email,
  Image,
  PictureAsPdf,
  TableChart,
  TextFields,
  Check,
  Error,
  Refresh,
  Save,
  ContentPaste,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import AdminLayout from './components/AdminLayout';
import api from '../../services/api';

// File type icons
const getFileIcon = (type) => {
  switch (type) {
    case '.pdf':
      return <PictureAsPdf sx={{ fontSize: 40, color: '#f44336' }} />;
    case '.xlsx':
    case '.xls':
      return <TableChart sx={{ fontSize: 40, color: '#4caf50' }} />;
    case '.docx':
      return <Description sx={{ fontSize: 40, color: '#2196f3' }} />;
    case '.eml':
    case '.msg':
      return <Email sx={{ fontSize: 40, color: '#ff9800' }} />;
    case '.jpg':
    case '.jpeg':
    case '.png':
      return <Image sx={{ fontSize: 40, color: '#9c27b0' }} />;
    default:
      return <TextFields sx={{ fontSize: 40, color: '#607d8b' }} />;
  }
};

const DocumentProcessPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [file, setFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Editable extracted data
  const [editedData, setEditedData] = useState({
    claim_number: '',
    insured_name: '',
    claimant_name: '',
    location: '',
    category: 'OTHER',
    priority: 'MEDIUM',
    title: '',
    description: '',
  });

  // Dropzone setup
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setParseResult(null);
      setError(null);
      setSuccess(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'message/rfc822': ['.eml'],
      'application/vnd.ms-outlook': ['.msg'],
      'image/*': ['.jpg', '.jpeg', '.png', '.tiff', '.bmp'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // Parse file
  const handleParseFile = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);
    setParseResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/documents/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setParseResult(response.data);
      
      // Populate editable fields
      if (response.data.extracted_data) {
        setEditedData(prev => ({
          ...prev,
          ...response.data.extracted_data,
          title: `Case - ${response.data.extracted_data.insured_name || response.data.extracted_data.claimant_name || 'New'}`,
          description: response.data.text_preview || '',
        }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse document');
    } finally {
      setParsing(false);
    }
  };

  // Parse text
  const handleParseText = async () => {
    if (!textContent.trim()) return;

    setParsing(true);
    setError(null);
    setParseResult(null);

    try {
      const response = await api.post('/documents/parse-text', { text: textContent });

      setParseResult(response.data);
      
      // Populate editable fields
      if (response.data.extracted_data) {
        setEditedData(prev => ({
          ...prev,
          ...response.data.extracted_data,
          title: `Case - ${response.data.extracted_data.insured_name || response.data.extracted_data.claimant_name || 'New'}`,
          description: textContent,
        }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse text');
    } finally {
      setParsing(false);
    }
  };

  // Create case
  const handleCreateCase = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post('/documents/create-case-with-data', editedData);

      setSuccess(`Case ${response.data.case_number} created successfully!`);
      
      // Reset form
      setFile(null);
      setTextContent('');
      setParseResult(null);
      setEditedData({
        claim_number: '',
        insured_name: '',
        claimant_name: '',
        location: '',
        category: 'OTHER',
        priority: 'MEDIUM',
        title: '',
        description: '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  // Handle input change
  const handleInputChange = (field) => (event) => {
    setEditedData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  // Reset form
  const handleReset = () => {
    setFile(null);
    setTextContent('');
    setParseResult(null);
    setError(null);
    setSuccess(null);
    setEditedData({
      claim_number: '',
      insured_name: '',
      claimant_name: '',
      location: '',
      category: 'OTHER',
      priority: 'MEDIUM',
      title: '',
      description: '',
    });
  };

  return (
    <AdminLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Process Document
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload documents or paste email content to automatically extract case details
        </Typography>
      </Box>

      {/* Success/Error Alerts */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Panel - Input */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '12px', border: '1px solid #e0e0e0' }}>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
              <Tab icon={<CloudUpload />} label="Upload File" />
              <Tab icon={<ContentPaste />} label="Paste Text" />
            </Tabs>

            {/* File Upload Tab */}
            {activeTab === 0 && (
              <>
                <Box
                  {...getRootProps()}
                  sx={{
                    border: '2px dashed',
                    borderColor: isDragActive ? '#667eea' : '#e0e0e0',
                    borderRadius: '12px',
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: isDragActive ? '#f0f4ff' : '#fafafa',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#667eea',
                      backgroundColor: '#f0f4ff',
                    },
                  }}
                >
                  <input {...getInputProps()} />
                  <CloudUpload sx={{ fontSize: 48, color: '#667eea', mb: 2 }} />
                  <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
                    {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    or click to browse
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    Supported: PDF, Excel, Word, Email (.eml/.msg), Images
                  </Typography>
                </Box>

                {file && (
                  <Card sx={{ mt: 2, backgroundColor: '#f8f9fa' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {getFileIcon(`.${file.name.split('.').pop()}`)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(file.size / 1024).toFixed(2)} KB
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        onClick={handleParseFile}
                        disabled={parsing}
                        sx={{
                          backgroundColor: '#667eea',
                          '&:hover': { backgroundColor: '#5a6fd6' },
                        }}
                      >
                        {parsing ? <CircularProgress size={24} color="inherit" /> : 'Parse'}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Text Paste Tab */}
            {activeTab === 1 && (
              <>
                <TextField
                  multiline
                  rows={12}
                  fullWidth
                  placeholder="Paste email content or any text containing case information here...

Example:
From: insurance@company.com
Subject: New Claim - Policy #12345

Dear Sir,

Please investigate the following claim:
Claim Number: CLM-2026-001
Insured Name: John Doe
Claimant: Jane Smith
Date of Accident: 15/01/2026
Location: Main Road, Mumbai
Vehicle No: MH-01-AB-1234

..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'monospace',
                      fontSize: '14px',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleParseText}
                  disabled={parsing || !textContent.trim()}
                  sx={{
                    mt: 2,
                    backgroundColor: '#667eea',
                    '&:hover': { backgroundColor: '#5a6fd6' },
                  }}
                >
                  {parsing ? <CircularProgress size={24} color="inherit" /> : 'Extract Data'}
                </Button>
              </>
            )}

            {/* Supported Formats Info */}
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Supported Formats:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip icon={<PictureAsPdf />} label="PDF" size="small" />
                <Chip icon={<TableChart />} label="Excel" size="small" />
                <Chip icon={<Description />} label="Word" size="small" />
                <Chip icon={<Email />} label="Email" size="small" />
                <Chip icon={<Image />} label="Images" size="small" />
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Right Panel - Results & Create */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: '12px', border: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Extracted Data
              </Typography>
              {parseResult && (
                <Chip
                  icon={parseResult.success ? <Check /> : <Error />}
                  label={parseResult.success ? 'Parsed' : 'Failed'}
                  color={parseResult.success ? 'success' : 'error'}
                  size="small"
                />
              )}
            </Box>

            {!parseResult ? (
              <Box sx={{ textAlign: 'center', py: 6, color: '#999' }}>
                <Description sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                <Typography>Upload a file or paste text to extract case data</Typography>
              </Box>
            ) : (
              <>
                {/* Preview Text */}
                {parseResult.text_preview && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Extracted Text Preview:
                    </Typography>
                    <Box
                      sx={{
                        maxHeight: '150px',
                        overflow: 'auto',
                        p: 2,
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {parseResult.text_preview}
                    </Box>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Editable Fields */}
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Review & Edit:
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Title"
                      value={editedData.title}
                      onChange={handleInputChange('title')}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Claim Number"
                      value={editedData.claim_number || ''}
                      onChange={handleInputChange('claim_number')}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={editedData.category || 'OTHER'}
                        onChange={handleInputChange('category')}
                        label="Category"
                      >
                        <MenuItem value="MACT">MACT</MenuItem>
                        <MenuItem value="CIVIL">Civil</MenuItem>
                        <MenuItem value="CRIMINAL">Criminal</MenuItem>
                        <MenuItem value="CONSUMER">Consumer</MenuItem>
                        <MenuItem value="OTHER">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Insured Name"
                      value={editedData.insured_name || ''}
                      onChange={handleInputChange('insured_name')}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Claimant Name"
                      value={editedData.claimant_name || ''}
                      onChange={handleInputChange('claimant_name')}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Location"
                      value={editedData.location || ''}
                      onChange={handleInputChange('location')}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Priority</InputLabel>
                      <Select
                        value={editedData.priority || 'MEDIUM'}
                        onChange={handleInputChange('priority')}
                        label="Priority"
                      >
                        <MenuItem value="LOW">Low</MenuItem>
                        <MenuItem value="MEDIUM">Medium</MenuItem>
                        <MenuItem value="HIGH">High</MenuItem>
                        <MenuItem value="CRITICAL">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Action Buttons */}
                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    startIcon={<Refresh />}
                    sx={{ flex: 1 }}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleCreateCase}
                    disabled={creating}
                    startIcon={creating ? <CircularProgress size={20} color="inherit" /> : <Save />}
                    sx={{
                      flex: 2,
                      backgroundColor: '#667eea',
                      '&:hover': { backgroundColor: '#5a6fd6' },
                    }}
                  >
                    {creating ? 'Creating...' : 'Create Case'}
                  </Button>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </AdminLayout>
  );
};

export default DocumentProcessPage;
