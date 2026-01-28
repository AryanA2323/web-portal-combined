import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context';
import { CircularProgress, Box } from '@mui/material';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access (case-insensitive comparison)
  const userRole = user?.role?.toLowerCase().replace(/_/g, '_');
  const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());
  
  if (allowedRoles.length > 0 && !normalizedAllowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on user role
    const roleRedirects = {
      admin: '/admin/dashboard',
      super_admin: '/super-admin/dashboard',
      vendor: '/vendor/dashboard',
      client: '/client/dashboard',
      lawyer: '/lawyer/dashboard',
    };
    
    const targetPath = roleRedirects[userRole] || '/login';
    
    // Prevent redirect loop - if already on the target path, don't redirect
    if (location.pathname === targetPath) {
      return children;
    }
    
    return <Navigate to={targetPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
