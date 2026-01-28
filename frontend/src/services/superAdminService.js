import api from './api';

/**
 * Super Admin API Service
 * Handles all super admin related API calls
 */

// Get super admin dashboard statistics
export const getSuperAdminDashboard = async () => {
  const response = await api.get('/super-admin/dashboard');
  return response.data;
};

// Get user statistics
export const getUserStatistics = async () => {
  const response = await api.get('/super-admin/users/statistics');
  return response.data;
};

// Get vendor statistics
export const getVendorStatistics = async () => {
  const response = await api.get('/super-admin/vendors/statistics');
  return response.data;
};

const superAdminService = {
  getSuperAdminDashboard,
  getUserStatistics,
  getVendorStatistics,
};

export default superAdminService;
