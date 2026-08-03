// Role configuration
export const ROLES = {
  QC: 'qc',
  CASE_MANAGER: 'case_manager',
  SUPER_ADMIN: 'super_admin', // Support for sub-role being returned as main role
};

// Role display information
export const ROLE_CONFIG = {
  [ROLES.QC]: {
    label: 'QC',
    description: 'Manage legal cases and incidents',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    icon: 'Gavel',
    dashboardPath: '/qc/dashboard',
  },
  [ROLES.CASE_MANAGER]: {
    label: 'Case Manager',
    description: 'System administration',
    color: '#d32f2f',
    bgColor: '#ffebee',
    icon: 'AdminPanelSettings',
    dashboardPath: '/case_manager/dashboard',
  },
  [ROLES.SUPER_ADMIN]: {
    label: 'Super Admin',
    description: 'System administration',
    color: '#d32f2f',
    bgColor: '#ffebee',
    icon: 'AdminPanelSettings',
    dashboardPath: '/case_manager/dashboard',
  },
};

// Get role-specific redirect path (case-insensitive)
export const getRoleDashboard = (role) => {
  const normalizedRole = role?.toLowerCase().replace(/_/g, '_');
  
  // Handle 'admin', 'case_manager' and 'super_admin' roles
  if (normalizedRole === 'super_admin' || normalizedRole === 'case_manager' || normalizedRole === 'admin') {
    return '/case_manager/dashboard';
  }
  
  return ROLE_CONFIG[normalizedRole]?.dashboardPath || '/';
};

// CaseManager sub-roles
export const ADMIN_SUB_ROLES = {
  CASE_HANDLER: 'case_handler',
  REPORT_MANAGER: 'report_manager',
  LOG_MANAGER: 'log_manager',
  SUPER_ADMIN: 'super_admin',
};

// Default permissions for regular case manager (all pages except users)
const DEFAULT_ADMIN_PERMISSIONS = [
  '/case_manager/dashboard',
  '/case_manager/cases',
  '/case_manager/ai-brief',
  '/case_manager/legal-review',
  '/case_manager/reports',
  '/case_manager/audit-logs',
  '/case_manager/settings',
];

// Super admin gets access to users page
const SUPER_ADMIN_PERMISSIONS = [
  '/case_manager/dashboard',
  '/case_manager/users',
  '/case_manager/clients',
];

// Sub-role configuration with permissions
export const SUB_ROLE_CONFIG = {
  case_handler: {
    label: 'Case Handler',
    description: 'Manage and handle cases',
    icon: 'FolderOpen',
    permissions: ['/case_manager/dashboard', '/case_manager/cases']
  },
  report_manager: {
    label: 'Report Manager',
    description: 'Generate and manage reports',
    icon: 'Assessment',
    permissions: ['/case_manager/dashboard', '/case_manager/reports']
  },
  log_manager: {
    label: 'Log Manager',
    description: 'Manage system logs',
    icon: 'History',
    permissions: ['/case_manager/dashboard', '/case_manager/audit-logs']
  },
  super_admin: {
    label: 'Super Admin',
    description: 'Manage users and system settings',
    icon: 'SupervisorAccount',
    permissions: SUPER_ADMIN_PERMISSIONS
  }
};

// Get allowed menu items for a user based on their sub-role or custom permissions
export const getMenuItemsForUser = (user) => {
  if (!user) {
    return [];
  }
  
  const userRole = user.role?.toLowerCase();
  
  // Allow 'admin', 'case_manager' and 'super_admin' roles
  if (userRole !== 'case_manager' && userRole !== 'super_admin' && userRole !== 'admin') {
    return [];
  }
  
  // Check if user has custom permissions set
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions;
  }
  
  // If role is 'super_admin' or sub_role is 'super_admin', return super admin permissions
  const subRole = user.sub_role?.toLowerCase();
  if (userRole === 'super_admin' || subRole === 'super_admin') {
    return SUPER_ADMIN_PERMISSIONS;
  }
  
  // If user has a specific sub-role, use those permissions
  if (subRole && SUB_ROLE_CONFIG[subRole]) {
    return SUB_ROLE_CONFIG[subRole].permissions;
  }
  
  // Default: regular case manager gets all pages except users
  return DEFAULT_ADMIN_PERMISSIONS;
};

// Check if user has permission to access a path
export const hasPermission = (user, path) => {
  const allowedPaths = getMenuItemsForUser(user);
  return allowedPaths.includes(path);
};
