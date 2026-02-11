// Role configuration
export const ROLES = {
  LAWYER: 'lawyer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin', // Support for sub-role being returned as main role
};

// Role display information
export const ROLE_CONFIG = {
  [ROLES.LAWYER]: {
    label: 'Lawyer',
    description: 'Manage legal cases and incidents',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    icon: 'Gavel',
    dashboardPath: '/lawyer/dashboard',
  },
  [ROLES.ADMIN]: {
    label: 'Admin',
    description: 'System administration',
    color: '#d32f2f',
    bgColor: '#ffebee',
    icon: 'AdminPanelSettings',
    dashboardPath: '/admin/dashboard',
  },
  [ROLES.SUPER_ADMIN]: {
    label: 'Super Admin',
    description: 'System administration',
    color: '#d32f2f',
    bgColor: '#ffebee',
    icon: 'AdminPanelSettings',
    dashboardPath: '/admin/dashboard',
  },
};

// Get role-specific redirect path (case-insensitive)
export const getRoleDashboard = (role) => {
  const normalizedRole = role?.toLowerCase().replace(/_/g, '_');
  
  // Handle both 'admin' and 'super_admin' roles
  if (normalizedRole === 'super_admin' || normalizedRole === 'admin') {
    return '/admin/dashboard';
  }
  
  return ROLE_CONFIG[normalizedRole]?.dashboardPath || '/';
};

// Admin sub-roles
export const ADMIN_SUB_ROLES = {
  CASE_HANDLER: 'case_handler',
  REPORT_MANAGER: 'report_manager',
  LOG_MANAGER: 'log_manager',
  SUPER_ADMIN: 'super_admin',
};

// Default permissions for regular admin (all pages except users)
const DEFAULT_ADMIN_PERMISSIONS = [
  '/admin/dashboard',
  '/admin/cases',
  '/admin/email-intake',
  '/admin/process-document',
  '/admin/ai-brief',
  '/admin/legal-review',
  '/admin/reports',
  '/admin/audit-logs',
  '/admin/settings',
];

// Super admin gets access to users page
const SUPER_ADMIN_PERMISSIONS = [
  '/admin/dashboard',
  '/admin/users',
];

// Sub-role configuration with permissions
export const SUB_ROLE_CONFIG = {
  case_handler: {
    label: 'Case Handler',
    description: 'Manage and handle cases',
    icon: 'FolderOpen',
    permissions: ['/admin/dashboard', '/admin/cases', '/admin/process-document', '/admin/email-intake']
  },
  report_manager: {
    label: 'Report Manager',
    description: 'Generate and manage reports',
    icon: 'Assessment',
    permissions: ['/admin/dashboard', '/admin/reports']
  },
  log_manager: {
    label: 'Log Manager',
    description: 'Manage system logs',
    icon: 'History',
    permissions: ['/admin/dashboard', '/admin/audit-logs']
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
  
  // Allow both 'admin' and 'super_admin' roles
  if (userRole !== 'admin' && userRole !== 'super_admin') {
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
  
  // Default: regular admin gets all pages except users
  return DEFAULT_ADMIN_PERMISSIONS;
};

// Check if user has permission to access a path
export const hasPermission = (user, path) => {
  const allowedPaths = getMenuItemsForUser(user);
  return allowedPaths.includes(path);
};
