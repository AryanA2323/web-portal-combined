// Role configuration
export const ROLES = {
  QC: 'qc',
  CASE_MANAGER: 'case_manager',
  SUPER_ADMIN: 'super_admin', // Support for sub-role being returned as main role
};

// Unified Role Color Schemes for Badges, Cards, and Selectors
export const ROLE_STYLE_CONFIG = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    color: '#7c3aed',
    bgColor: '#f3e8ff',
    borderColor: '#d8b4fe',
    textColor: '#6b21a8',
    chipColor: 'secondary',
  },
  CASE_MANAGER: {
    label: 'Case Manager',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    textColor: '#1e40af',
    chipColor: 'primary',
  },
  VENDOR: {
    label: 'Business Partner',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    textColor: '#92400e',
    chipColor: 'warning',
  },
  QC: {
    label: 'Quality Analyst',
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    textColor: '#065f46',
    chipColor: 'success',
  },
  CLIENT: {
    label: 'Client',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
    textColor: '#115e59',
    chipColor: 'info',
  },
  ADVOCATE: {
    label: 'Legal Partner',
    color: '#e11d48',
    bgColor: '#fff1f2',
    borderColor: '#fecdd3',
    textColor: '#9f1239',
    chipColor: 'error',
  },
};

export const getRoleStyle = (roleInput) => {
  if (!roleInput) return ROLE_STYLE_CONFIG.CLIENT;
  const raw = String(roleInput).trim().toUpperCase().replace(/\s+/g, '_');

  if (ROLE_STYLE_CONFIG[raw]) {
    return ROLE_STYLE_CONFIG[raw];
  }

  if (raw === 'SUPER_ADMIN' || raw === 'SUPER_ADMINISTRATOR') return ROLE_STYLE_CONFIG.SUPER_ADMIN;
  if (raw === 'CASE_MANAGER' || raw === 'CASE_HANDLER') return ROLE_STYLE_CONFIG.CASE_MANAGER;
  if (raw === 'BUSINESS_PARTNER' || raw === 'VENDOR' || raw === 'VENDORS') return ROLE_STYLE_CONFIG.VENDOR;
  if (raw === 'QUALITY_ANALYST' || raw === 'QC' || raw === 'QUALITY_CHECK') return ROLE_STYLE_CONFIG.QC;
  if (raw === 'LEGAL_PARTNER' || raw === 'ADVOCATE' || raw === 'ADVOCATES') return ROLE_STYLE_CONFIG.ADVOCATE;
  if (raw === 'CLIENT' || raw === 'CLIENTS') return ROLE_STYLE_CONFIG.CLIENT;

  return {
    label: roleInput,
    color: '#64748b',
    bgColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    textColor: '#334155',
    chipColor: 'default',
  };
};

// Role display information
export const ROLE_CONFIG = {
  [ROLES.QC]: {
    label: 'Quality Analyst',
    description: 'Manage legal cases and incidents',
    color: ROLE_STYLE_CONFIG.QC.color,
    bgColor: ROLE_STYLE_CONFIG.QC.bgColor,
    icon: 'Gavel',
    dashboardPath: '/qc/dashboard',
  },
  [ROLES.CASE_MANAGER]: {
    label: 'Case Manager',
    description: 'System administration',
    color: ROLE_STYLE_CONFIG.CASE_MANAGER.color,
    bgColor: ROLE_STYLE_CONFIG.CASE_MANAGER.bgColor,
    icon: 'AdminPanelSettings',
    dashboardPath: '/case_manager/dashboard',
  },
  [ROLES.SUPER_ADMIN]: {
    label: 'Super Admin',
    description: 'System administration',
    color: ROLE_STYLE_CONFIG.SUPER_ADMIN.color,
    bgColor: ROLE_STYLE_CONFIG.SUPER_ADMIN.bgColor,
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
  '/case_manager/closed-cases',
  '/case_manager/ai-case-review',
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
  '/super-admin/approvals',
  '/super-admin/logs',
];

// Sub-role configuration with permissions
export const SUB_ROLE_CONFIG = {
  case_handler: {
    label: 'Case Handler',
    description: 'Manage and handle cases',
    icon: 'FolderOpen',
    permissions: ['/case_manager/dashboard', '/case_manager/cases', '/case_manager/closed-cases']
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

  let allowedPaths = [];
  
  // Check if user has custom permissions set
  if (user.permissions && user.permissions.length > 0) {
    allowedPaths = user.permissions;
  } else {
    // If role is 'super_admin' or sub_role is 'super_admin', return super admin permissions
    const subRole = user.sub_role?.toLowerCase();
    if (userRole === 'super_admin' || subRole === 'super_admin') {
      allowedPaths = SUPER_ADMIN_PERMISSIONS;
    }
    // If user has a specific sub-role, use those permissions
    else if (subRole && SUB_ROLE_CONFIG[subRole]) {
      allowedPaths = SUB_ROLE_CONFIG[subRole].permissions;
    } else {
      // Default: regular case manager gets all pages except users
      allowedPaths = DEFAULT_ADMIN_PERMISSIONS;
    }
  }

  // Enforce global restriction: non-super-admins can NEVER see users or clients pages
  if (userRole !== 'super_admin') {
    allowedPaths = allowedPaths.filter(path => 
      path !== '/case_manager/users' && path !== '/case_manager/clients'
    );
  }

  return allowedPaths;
};

// Check if user has permission to access a path
export const hasPermission = (user, path) => {
  const allowedPaths = getMenuItemsForUser(user);
  return allowedPaths.includes(path);
};
