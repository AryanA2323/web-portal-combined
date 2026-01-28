import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Button,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  LocationOn,
  TrendingUp,
  Star,
  TrendingDown,
  Add,
  Search,
  Phone,
  Email,
  Close,
} from '@mui/icons-material';
import AdminLayout from './components/AdminLayout';
import StatCard from './components/StatCard';
import api from '../../services/api';

const VendorCard = ({ vendor, onViewProfile }) => {
  // Generate initials from company name
  const getInitials = (name) => {
    if (!name) return '??';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(vendor.company_name);
  const location = `${vendor.city}, ${vendor.state}`;
  
  return (
  <Card 
    sx={{ 
      height: '100%', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderRadius: '12px',
      border: '1px solid #f0f0f0',
      transition: 'all 0.2s ease',
      '&:hover': { 
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        transform: 'translateY(-2px)',
      } 
    }}
  >
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1 }}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              backgroundColor: '#3498db',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, fontSize: '16px', lineHeight: 1.3 }}>
              {vendor.company_name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOn sx={{ fontSize: 14, color: '#95a5a6' }} />
              <Typography variant="body2" sx={{ color: '#7f8c8d', fontSize: '13px' }}>
                {location}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Chip
          label={vendor.is_active ? 'active' : 'inactive'}
          size="small"
          sx={{
            backgroundColor: vendor.is_active ? '#27ae60' : '#95a5a6',
            color: '#fff',
            fontWeight: 500,
            fontSize: '11px',
            height: '22px',
            textTransform: 'lowercase',
          }}
        />
      </Box>

      <Box sx={{ mb: 2.5, pl: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
          <Phone sx={{ fontSize: 14, color: '#95a5a6' }} />
          <Typography variant="body2" sx={{ color: '#7f8c8d', fontSize: '13px' }}>
            {vendor.contact_phone || 'N/A'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Email sx={{ fontSize: 14, color: '#95a5a6' }} />
          <Typography variant="body2" sx={{ color: '#7f8c8d', fontSize: '13px' }}>
            {vendor.contact_email}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 2, pl: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocationOn sx={{ fontSize: 16, color: '#3498db' }} />
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '14px' }}>
            {vendor.latitude && vendor.longitude ? 'Location Set' : 'No Location'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
        <Chip 
          label={vendor.city}
          size="small" 
          sx={{ 
            fontSize: '11px',
            height: '24px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #e0e0e0',
          }} 
        />
        {vendor.state && (
          <Chip 
            label={vendor.state}
            size="small" 
            sx={{ 
              fontSize: '11px',
              height: '24px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #e0e0e0',
            }} 
          />
        )}
      </Box>

      <Button
        fullWidth
        variant="outlined"
        onClick={() => onViewProfile(vendor)}
        sx={{
          borderColor: '#3498db',
          color: '#3498db',
          textTransform: 'none',
          fontWeight: 600,
          py: 1,
          fontSize: '14px',
          '&:hover': {
            borderColor: '#2980b9',
            backgroundColor: 'rgba(52, 152, 219, 0.04)',
          },
        }}
      >
        View Profile
      </Button>
    </CardContent>
  </Card>
  );
};

const VendorsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    avgRating: 0,
    activeCases: 0,
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vendors');
      setVendors(response.data || []);
      
      // Calculate stats
      const activeVendors = response.data.filter(v => v.is_active);
      setStats({
        total: response.data.length,
        active: activeVendors.length,
        avgRating: 4.6, // You can calculate this from actual data if you have ratings
        activeCases: 0, // You can fetch this from cases API if needed
      });
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsData = [
    { title: 'Total Vendors', value: stats.total.toString(), icon: LocationOn, color: '#3498db', bgColor: '#e3f2fd' },
    { title: 'Active Vendors', value: stats.active.toString(), icon: TrendingUp, color: '#27ae60', bgColor: '#e8f5e9' },
    { title: 'Avg Rating', value: stats.avgRating.toString(), icon: Star, color: '#f39c12', bgColor: '#fff3e0' },
    { title: 'Active Cases', value: stats.activeCases.toString(), icon: TrendingUp, color: '#9b59b6', bgColor: '#f3e5f5' },
  ];

  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.state?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewProfile = (vendor) => {
    setSelectedVendor(vendor);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedVendor(null);
  };

  return (
    <AdminLayout>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      ) : (
      <Box sx={{ px: 0.5 }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 0.5 }}>
              Vendors
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage investigation vendors and assignments
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            sx={{
              backgroundColor: '#1a1a1a',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1,
              '&:hover': { backgroundColor: '#2c2c2c' },
            }}
          >
            Add Vendor
          </Button>
        </Box>

        {/* Stats Cards - Full Width Layout */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4, width: '100%' }}>
          {statsData.map((stat, index) => (
            <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
              <StatCard {...stat} />
            </Box>
          ))}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Vendor Directory
            </Typography>
            <TextField
              placeholder="Search vendors..."
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 20, color: '#999' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                width: 350,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#fff',
                },
              }}
            />
          </Box>

          {/* Vendor Cards Grid - 3 per row */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: 3,
            '@media (max-width: 1200px)': {
              gridTemplateColumns: 'repeat(2, 1fr)',
            },
            '@media (max-width: 768px)': {
              gridTemplateColumns: '1fr',
            },
          }}>
            {filteredVendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} onViewProfile={handleViewProfile} />
            ))}
          </Box>

          {filteredVendors.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary">No vendors found</Typography>
            </Box>
          )}
        </Box>
      </Box>
      )}

      {/* Vendor Profile Modal */}
      <Dialog 
        open={modalOpen} 
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 2,
        }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Vendor Profile
          </Typography>
          <IconButton onClick={handleCloseModal} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          {selectedVendor && (
            <Box>
              {/* Header Section */}
              <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    backgroundColor: '#3498db',
                    fontSize: '28px',
                    fontWeight: 600,
                  }}
                >
                  {(() => {
                    const words = selectedVendor.company_name.split(' ');
                    if (words.length >= 2) {
                      return (words[0][0] + words[1][0]).toUpperCase();
                    }
                    return selectedVendor.company_name.substring(0, 2).toUpperCase();
                  })()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {selectedVendor.company_name}
                    </Typography>
                    <Chip
                      label={selectedVendor.is_active ? 'active' : 'inactive'}
                      sx={{
                        backgroundColor: selectedVendor.is_active ? '#27ae60' : '#95a5a6',
                        color: '#fff',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LocationOn sx={{ fontSize: 20, color: '#7f8c8d' }} />
                    <Typography variant="body1" color="text.secondary">
                      {selectedVendor.city}, {selectedVendor.state}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOn sx={{ fontSize: 20, color: '#3498db' }} />
                      <Typography variant="body2" color="text.secondary">
                        {selectedVendor.latitude && selectedVendor.longitude ? 'Location coordinates available' : 'No location set'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Contact Information */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Contact Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                      <Phone sx={{ color: '#3498db' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Phone
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {selectedVendor.contact_phone || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                      <Email sx={{ color: '#3498db' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Email
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {selectedVendor.contact_email}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Address Information */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Address
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip 
                    label={selectedVendor.address || 'N/A'}
                    sx={{
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      fontWeight: 500,
                      fontSize: '14px',
                    }}
                  />
                  <Chip 
                    label={`${selectedVendor.city}, ${selectedVendor.state}`}
                    sx={{
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      fontWeight: 500,
                      fontSize: '14px',
                    }}
                  />
                  <Chip 
                    label={selectedVendor.postal_code || 'N/A'}
                    sx={{
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      fontWeight: 500,
                      fontSize: '14px',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={handleCloseModal} variant="outlined" sx={{ textTransform: 'none', px: 3 }}>
            Close
          </Button>
          <Button 
            variant="contained" 
            sx={{ 
              textTransform: 'none', 
              px: 3,
              backgroundColor: '#3498db',
              '&:hover': { backgroundColor: '#2980b9' },
            }}
          >
            Edit Vendor
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

export default VendorsPage;
