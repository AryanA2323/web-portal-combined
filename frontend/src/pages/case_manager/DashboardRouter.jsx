import { useAuth } from '../../context/AuthContext';
import DashboardPage from './DashboardPage';
import SuperAdminDashboard from './SuperAdminDashboard';

/**
 * Dashboard Router Component
 * Routes users to the appropriate dashboard based on their role
 */
const DashboardRouter = () => {
  const { user } = useAuth();

  // Check if user is super admin
  const isSuperAdmin = user?.sub_role?.toUpperCase() === 'SUPER_ADMIN';

  // Render appropriate dashboard
  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return <DashboardPage />;
};

export default DashboardRouter;
