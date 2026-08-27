import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Tooltip,
  Skeleton,
  Button,
  Avatar,
  Popover,
  Badge,
} from '@mui/material';
import {
  History,
  Close,
  Refresh,
  CheckCircle,
  AssignmentTurnedIn,
  GroupAdd,
  Person,
  SwapHoriz,
  Image as ImageIcon,
  Description,
  Mic,
  Smartphone,
  Computer,
  Bolt,
  AccessTime,
  Place,
  DirectionsCar,
  Shield,
  VerifiedUser,
  Article,
  UploadFile,
  ContentCopy,
  Tune,
  RestartAlt,
} from '@mui/icons-material';

// --- Formatting Helpers ---

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
};

const formatExactTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

const getDateGroupKey = (dateStr) => {
  if (!dateStr) return 'Other';
  const date = new Date(dateStr);
  const now = new Date();
  
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getCheckMeta = (checkType) => {
  const normalized = (checkType || '').toLowerCase();
  switch (normalized) {
    case 'spot':
    case 'spot_checks':
      return {
        label: 'Spot',
        icon: <Place sx={{ fontSize: 12 }} />,
        color: '#EA580C',
        bg: '#FFF7ED',
        border: '#FFEDD5',
      };
    case 'claimant':
    case 'claimant_checks':
      return {
        label: 'Claimant',
        icon: <Person sx={{ fontSize: 12 }} />,
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#DBEAFE',
      };
    case 'insured':
    case 'insured_checks':
      return {
        label: 'Insured',
        icon: <Shield sx={{ fontSize: 12 }} />,
        color: '#059669',
        bg: '#ECFDF5',
        border: '#D1FAE5',
      };
    case 'driver':
    case 'driver_checks':
      return {
        label: 'Driver',
        icon: <DirectionsCar sx={{ fontSize: 12 }} />,
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#EDE9FE',
      };
    case 'rto':
    case 'rto_checks':
      return {
        label: 'RTO',
        icon: <Article sx={{ fontSize: 12 }} />,
        color: '#0891B2',
        bg: '#ECFEFF',
        border: '#CFFAFE',
      };
    case 'chargesheet':
    case 'chargesheets':
    case 'chargesheet_checks':
      return {
        label: 'Chargesheet',
        icon: <Description sx={{ fontSize: 12 }} />,
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FEE2E2',
      };
    case 'rti':
    case 'rti_checks':
      return {
        label: 'RTI',
        icon: <Article sx={{ fontSize: 12 }} />,
        color: '#4B5563',
        bg: '#F3F4F6',
        border: '#E5E7EB',
      };
    default:
      if (!checkType) return null;
      return {
        label: checkType.charAt(0).toUpperCase() + checkType.slice(1),
        icon: <CheckCircle sx={{ fontSize: 12 }} />,
        color: '#17539C',
        bg: '#EFF6FF',
        border: '#DBEAFE',
      };
  }
};

const getEventConfig = (eventType, description = '') => {
  const type = (eventType || '').toUpperCase();
  const desc = (description || '').toLowerCase();

  if (type === 'CHECK_REVIEWED' || desc.includes('accepted by admin') || desc.includes('verified')) {
    return {
      title: 'Verified & Accepted',
      icon: <VerifiedUser sx={{ fontSize: 16, color: '#16A34A' }} />,
      dotBg: '#DCFCE7',
      dotBorder: '#86EFAC',
      badgeBg: '#F0FDF4',
      badgeColor: '#15803D',
      badgeBorder: '#BBF7D0',
      accentColor: '#16A34A',
      category: 'review',
    };
  }

  if (type === 'CHECK_SUBMITTED' || desc.includes('completed check') || desc.includes('submitted')) {
    return {
      title: 'Check Submitted',
      icon: <AssignmentTurnedIn sx={{ fontSize: 16, color: '#2563EB' }} />,
      dotBg: '#DBEAFE',
      dotBorder: '#93C5FD',
      badgeBg: '#EFF6FF',
      badgeColor: '#1D4ED8',
      badgeBorder: '#BFDBFE',
      accentColor: '#2563EB',
      category: 'submission',
    };
  }

  if (type.includes('REASSIGNED') || type.includes('ASSIGNED') || desc.includes('reassigned') || desc.includes('assigned to')) {
    return {
      title: 'Partner Assignment',
      icon: <GroupAdd sx={{ fontSize: 16, color: '#D97706' }} />,
      dotBg: '#FEF3C7',
      dotBorder: '#FCD34D',
      badgeBg: '#FFFBEB',
      badgeColor: '#B45309',
      badgeBorder: '#FDE68A',
      accentColor: '#D97706',
      category: 'assignment',
    };
  }

  if (type.includes('MEDIA') || type.includes('EVIDENCE') || desc.includes('photo') || desc.includes('upload')) {
    return {
      title: 'Evidence Uploaded',
      icon: <UploadFile sx={{ fontSize: 16, color: '#9333EA' }} />,
      dotBg: '#F3E8FF',
      dotBorder: '#D8B4FE',
      badgeBg: '#FAF5FF',
      badgeColor: '#7E22CE',
      badgeBorder: '#E9D5FF',
      accentColor: '#9333EA',
      category: 'media',
    };
  }

  if (type.includes('STATEMENT') || desc.includes('statement') || desc.includes('audio') || desc.includes('transcript')) {
    return {
      title: 'Statement Recorded',
      icon: <Mic sx={{ fontSize: 16, color: '#0891B2' }} />,
      dotBg: '#CFFAFE',
      dotBorder: '#67E8F9',
      badgeBg: '#ECFEFF',
      badgeColor: '#0E7490',
      badgeBorder: '#A5F3FC',
      accentColor: '#0891B2',
      category: 'statement',
    };
  }

  if (type.includes('STATUS') || desc.includes('status changed')) {
    return {
      title: 'Status Updated',
      icon: <SwapHoriz sx={{ fontSize: 16, color: '#4F46E5' }} />,
      dotBg: '#E0E7FF',
      dotBorder: '#A5B4FC',
      badgeBg: '#EEF2FF',
      badgeColor: '#4338CA',
      badgeBorder: '#C7D2FE',
      accentColor: '#4F46E5',
      category: 'status',
    };
  }

  if (type.includes('NOTICE') || desc.includes('notice') || desc.includes('134')) {
    return {
      title: 'Notice Generated',
      icon: <Description sx={{ fontSize: 16, color: '#475569' }} />,
      dotBg: '#E2E8F0',
      dotBorder: '#CBD5E1',
      badgeBg: '#F8FAFC',
      badgeColor: '#334155',
      badgeBorder: '#E2E8F0',
      accentColor: '#475569',
      category: 'document',
    };
  }

  // Default fallback
  return {
    title: type ? type.replace(/_/g, ' ').replace(/\bVENDOR\b/g, 'BUSINESS PARTNER') : 'Case Activity',
    icon: <History sx={{ fontSize: 16, color: '#17539C' }} />,
    dotBg: '#E0E7FF',
    dotBorder: '#BFDBFE',
    badgeBg: '#F0F7FF',
    badgeColor: '#17539C',
    badgeBorder: '#DBEAFE',
    accentColor: '#17539C',
    category: 'other',
  };
};

const getRoleConfig = (role) => {
  const normalized = (role || '').toUpperCase();
  switch (normalized) {
    case 'ADMIN':
    case 'CASE_MANAGER':
      return { label: 'Case Manager', bg: '#EFF6FF', color: '#1D4ED8', border: '#DBEAFE' };
    case 'VENDOR':
      return { label: 'Business Partner', bg: '#FFF7ED', color: '#C2410C', border: '#FFEDD5' };
    case 'ADVOCATE':
      return { label: 'Advocate', bg: '#FAF5FF', color: '#7E22CE', border: '#F3E8FF' };
    case 'SUPER_ADMIN':
      return { label: 'Super Admin', bg: '#FEF2F2', color: '#B91C1C', border: '#FEE2E2' };
    case 'QC':
      return { label: 'QC Team', bg: '#ECFDF5', color: '#047857', border: '#D1FAE5' };
    default:
      return { label: role || 'System', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
  }
};

const getSourceConfig = (source) => {
  const normalized = (source || '').toLowerCase();
  if (normalized.includes('vendor') || normalized.includes('app') || normalized.includes('mobile')) {
    return { label: 'Business Partner App', icon: <Smartphone sx={{ fontSize: 11 }} />, bg: '#F8FAFC', color: '#64748B' };
  }
  if (normalized.includes('case') || normalized.includes('portal') || normalized.includes('web')) {
    return { label: 'Web Portal', icon: <Computer sx={{ fontSize: 11 }} />, bg: '#F8FAFC', color: '#64748B' };
  }
  return { label: source || 'System', icon: <Bolt sx={{ fontSize: 11 }} />, bg: '#F8FAFC', color: '#64748B' };
};

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatLogDescription = (desc) => {
  if (!desc) return '';
  let text = desc.replace(/\bVendor\b/g, 'Business Partner').replace(/\bvendor\b/g, 'business partner');
  text = text.replace(/\bAdmin\b/g, 'Case Manager').replace(/\badmin\b/g, 'case manager');
  text = text.replace(/Super Case Manager/gi, 'Super Admin');
  text = text.replace(/SUPER_Case Manager/gi, 'SUPER_ADMIN');
  return text;
};

const formatActorName = (actor) => {
  if (!actor) return 'System';
  if (actor.toLowerCase() === 'admin') return 'Case Manager';
  return actor;
};

// --- Main Case Logs Drawer Component ---

const CaseLogsDrawer = ({
  open,
  onClose,
  target,
  logs = [],
  loading = false,
  onRefresh,
}) => {
  const [copiedCaseNumber, setCopiedCaseNumber] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);

  // Filter States
  const [selectedCheckFilter, setSelectedCheckFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');

  // Copy Case Number
  const handleCopyCaseNumber = () => {
    if (target?.case_number) {
      navigator.clipboard.writeText(target.case_number);
      setCopiedCaseNumber(true);
      setTimeout(() => setCopiedCaseNumber(false), 2000);
    }
  };

  // Distinct check types present in this case's logs
  const availableCheckTypes = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      if (log.check_type) {
        set.add(log.check_type.toLowerCase());
      }
    });
    return Array.from(set);
  }, [logs]);

  // Distinct roles present
  const availableRoles = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      if (log.actor_role) {
        set.add(log.actor_role.toUpperCase());
      }
    });
    return Array.from(set);
  }, [logs]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCheckFilter !== 'ALL') count += 1;
    if (selectedCategoryFilter !== 'ALL') count += 1;
    if (selectedRoleFilter !== 'ALL') count += 1;
    return count;
  }, [selectedCheckFilter, selectedCategoryFilter, selectedRoleFilter]);

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCheckFilter('ALL');
    setSelectedCategoryFilter('ALL');
    setSelectedRoleFilter('ALL');
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Check Type Filter
    if (selectedCheckFilter !== 'ALL') {
      result = result.filter(
        (log) => (log.check_type || '').toLowerCase() === selectedCheckFilter.toLowerCase()
      );
    }

    // Category Filter
    if (selectedCategoryFilter !== 'ALL') {
      result = result.filter((log) => {
        const cfg = getEventConfig(log.event_type, log.description);
        return cfg.category === selectedCategoryFilter;
      });
    }

    // Role Filter
    if (selectedRoleFilter !== 'ALL') {
      result = result.filter(
        (log) => (log.actor_role || '').toUpperCase() === selectedRoleFilter.toUpperCase()
      );
    }

    return result;
  }, [logs, selectedCheckFilter, selectedCategoryFilter, selectedRoleFilter]);

  // Group filtered logs by Date
  const groupedLogs = useMemo(() => {
    const groups = {};
    filteredLogs.forEach((log) => {
      const groupKey = getDateGroupKey(log.event_time);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(log);
    });
    return groups;
  }, [filteredLogs]);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 580, md: 700, lg: 760 },
            backgroundColor: '#F8FAFC',
            boxShadow: '-12px 0 36px rgba(15, 23, 42, 0.14)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '"Montserrat", "Segoe UI", sans-serif',
          },
        }}
      >
        {/* ── TOP HEADER BAR ── */}
        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: 2,
            background: 'linear-gradient(135deg, #17539C 0%, #0F3A70 100%)',
            color: '#ffffff',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Subtle Decorative Ambient Glow */}
          <Box
            sx={{
              position: 'absolute',
              top: -20,
              right: 60,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(243, 111, 33, 0.22) 0%, rgba(243, 111, 33, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '9px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.12)',
                }}
              >
                <History sx={{ color: '#ffffff', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    fontSize: '17px',
                    letterSpacing: '-0.3px',
                    color: '#ffffff',
                    lineHeight: 1.2,
                  }}
                >
                  Case Activity Logs
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  Audit trail & chronological event timeline
                </Typography>
              </Box>
            </Box>

            {/* Right Actions: Filter Button, Refresh & Close */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Filter Button */}
              <Badge
                badgeContent={activeFiltersCount}
                color="secondary"
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: '#F36F21',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '10.5px',
                    height: '18px',
                    minWidth: '18px',
                  },
                }}
              >
                <Button
                  variant="contained"
                  size="small"
                  onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                  startIcon={<Tune sx={{ fontSize: '15px !important' }} />}
                  sx={{
                    backgroundColor: activeFiltersCount > 0 ? '#F36F21' : 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    height: '32px',
                    px: 1.5,
                    borderRadius: '7px',
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: activeFiltersCount > 0 ? '#E05D0F' : 'rgba(255, 255, 255, 0.25)',
                      boxShadow: 'none',
                    },
                  }}
                >
                  Filter
                </Button>
              </Badge>

              {onRefresh && (
                <Tooltip title="Refresh Logs" arrow>
                  <IconButton
                    onClick={onRefresh}
                    disabled={loading}
                    size="small"
                    sx={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      },
                      width: 32,
                      height: 32,
                    }}
                  >
                    <Refresh
                      sx={{
                        fontSize: 17,
                        animation: loading ? 'spin 1s linear infinite' : 'none',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' },
                        },
                      }}
                    />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Close Panel" arrow>
                <IconButton
                  onClick={onClose}
                  size="small"
                  sx={{
                    color: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    },
                    width: 32,
                    height: 32,
                  }}
                >
                  <Close sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Sub Header: Case Badge & Active Filter Summary */}
          {target && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
                mt: 1.25,
                pt: 1.25,
                borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={copiedCaseNumber ? 'Copied!' : 'Click to copy case number'} arrow>
                  <Chip
                    size="small"
                    label={target.case_number || `Case #${target.id}`}
                    onClick={handleCopyCaseNumber}
                    icon={<ContentCopy sx={{ fontSize: '12px !important', color: '#ffffff !important' }} />}
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '11.5px',
                      letterSpacing: '0.3px',
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      cursor: 'pointer',
                      height: '24px',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      },
                    }}
                  />
                </Tooltip>
                {copiedCaseNumber && (
                  <Typography variant="caption" sx={{ color: '#86EFAC', fontWeight: 600, fontSize: '11px' }}>
                    Copied!
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {activeFiltersCount > 0 && (
                  <Chip
                    size="small"
                    label={`Filtered: ${filteredLogs.length} of ${logs.length}`}
                    onDelete={handleResetFilters}
                    sx={{
                      backgroundColor: 'rgba(243, 111, 33, 0.3)',
                      color: '#FFF7ED',
                      border: '1px solid rgba(243, 111, 33, 0.5)',
                      fontWeight: 600,
                      fontSize: '11px',
                      height: '22px',
                      '& .MuiChip-deleteIcon': {
                        color: '#FFF7ED !important',
                        fontSize: '14px',
                        '&:hover': { color: '#ffffff !important' },
                      },
                    }}
                  />
                )}
                <Chip
                  size="small"
                  label={`${filteredLogs.length} ${filteredLogs.length === 1 ? 'Log' : 'Logs'}`}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    fontWeight: 600,
                    fontSize: '11px',
                    height: '22px',
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* ── LOGS TIMELINE STREAM ── */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2.5, sm: 3.5 },
            py: 2,
            position: 'relative',
            '::-webkit-scrollbar': { width: '6px' },
            '::-webkit-scrollbar-track': { background: '#F1F5F9' },
            '::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: '4px' },
            '::-webkit-scrollbar-thumb:hover': { background: '#94A3B8' },
          }}
        >
          {/* Loading State */}
          {loading ? (
            <Stack spacing={1.5}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                  <Skeleton variant="circular" width={34} height={34} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="rounded" height={48} sx={{ borderRadius: '8px' }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : filteredLogs.length === 0 ? (
            /* Empty State */
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
                px: 3,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                  border: '2px dashed #BFDBFE',
                }}
              >
                <History sx={{ fontSize: 32, color: '#17539C' }} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1E293B', mb: 0.5, fontSize: '15px' }}>
                {activeFiltersCount > 0 ? 'No Logs Match Active Filters' : 'No Activity Logs Recorded'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', maxWidth: 320, fontSize: '12.5px', mb: 2 }}>
                {activeFiltersCount > 0
                  ? 'Try clearing or changing your filter criteria to view more activity logs.'
                  : 'Actions taken on this case will be automatically logged here in real time.'}
              </Typography>
              {activeFiltersCount > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleResetFilters}
                  startIcon={<RestartAlt sx={{ fontSize: 16 }} />}
                  sx={{
                    borderColor: '#17539C',
                    color: '#17539C',
                    borderRadius: '6px',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </Box>
          ) : (
            /* Grouped Timeline Stream with Vertical Centered Nodes */
            <Box sx={{ position: 'relative' }}>
              {/* Continuous Vertical Timeline Line */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  bottom: 12,
                  left: '16px',
                  width: '2px',
                  backgroundColor: '#E2E8F0',
                  zIndex: 0,
                }}
              />

              {Object.keys(groupedLogs).map((dateGroupKey) => {
                const logsInGroup = groupedLogs[dateGroupKey];
                return (
                  <Box key={dateGroupKey} sx={{ mb: 2.5, position: 'relative', zIndex: 1 }}>
                    {/* Date Section Header - Centered directly to the vertical timeline line */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, position: 'relative' }}>
                      <Chip
                        label={dateGroupKey}
                        size="small"
                        sx={{
                          position: 'relative',
                          left: '17px',
                          transform: 'translateX(-50%)',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#334155',
                          fontWeight: 700,
                          fontSize: '10.5px',
                          letterSpacing: '0.3px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                          height: '22px',
                          zIndex: 2,
                          whiteSpace: 'nowrap',
                        }}
                      />
                      <Box
                        sx={{
                          flex: 1,
                          height: '1px',
                          backgroundColor: '#E2E8F0',
                          ml: 3,
                        }}
                      />
                    </Box>

                    {/* Compact Activity Cards */}
                    <Stack spacing={1.25} sx={{ position: 'relative' }}>
                      {logsInGroup.map((log) => {
                        const eventCfg = getEventConfig(log.event_type, log.description);
                        const checkMeta = getCheckMeta(log.check_type);
                        const roleMeta = getRoleConfig(log.actor_role);
                        const sourceMeta = getSourceConfig(log.source);

                        return (
                          <Box
                            key={log.id}
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              alignItems: 'center', // ── Vertically Aligns Timeline Icon Center to Card ──
                              position: 'relative',
                            }}
                          >
                            {/* Timeline Node Icon (Centered to Card) */}
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                backgroundColor: eventCfg.dotBg,
                                border: `2px solid ${eventCfg.dotBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                zIndex: 1,
                                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.06)',
                              }}
                            >
                              {eventCfg.icon}
                            </Box>

                            {/* Streamlined Compact Event Card (Reduced Height) */}
                            <Paper
                              elevation={0}
                              sx={{
                                flex: 1,
                                px: 1.75,
                                py: 1.1,
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                borderLeft: `3.5px solid ${eventCfg.accentColor}`,
                                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  borderColor: '#CBD5E1',
                                  borderLeftColor: eventCfg.accentColor,
                                  backgroundColor: '#FAFCFF',
                                  boxShadow: '0 2px 8px rgba(23, 83, 156, 0.07)',
                                },
                              }}
                            >
                              {/* Top Compact Row: Badges & Timestamp */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 1,
                                  mb: 0.5,
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                                  {/* Event Category Tag */}
                                  <Chip
                                    size="small"
                                    label={eventCfg.title}
                                    sx={{
                                      height: '19px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      backgroundColor: eventCfg.badgeBg,
                                      color: eventCfg.badgeColor,
                                      border: `1px solid ${eventCfg.badgeBorder}`,
                                      borderRadius: '4px',
                                      px: 0.25,
                                    }}
                                  />

                                  {/* Check Type Tag */}
                                  {checkMeta && (
                                    <Chip
                                      size="small"
                                      icon={checkMeta.icon}
                                      label={checkMeta.label}
                                      sx={{
                                        height: '19px',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        backgroundColor: checkMeta.bg,
                                        color: checkMeta.color,
                                        border: `1px solid ${checkMeta.border}`,
                                        borderRadius: '4px',
                                        '& .MuiChip-icon': {
                                          color: `${checkMeta.color} !important`,
                                          ml: 0.25,
                                        },
                                      }}
                                    />
                                  )}
                                </Box>

                                {/* Exact / Relative Timestamp */}
                                <Tooltip title={formatExactTime(log.event_time)} arrow placement="top">
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.35,
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      color: '#64748B',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <AccessTime sx={{ fontSize: 11, color: '#94A3B8' }} />
                                    {formatRelativeTime(log.event_time)}
                                  </Typography>
                                </Tooltip>
                              </Box>

                              {/* Middle: Clean Description (No "Field: check_status" text) */}
                              <Typography
                                sx={{
                                  fontSize: '12.5px',
                                  fontWeight: 600,
                                  color: '#1E293B',
                                  lineHeight: 1.35,
                                  mb: 0.6,
                                }}
                              >
                                {formatLogDescription(log.description)}
                              </Typography>

                              {/* Bottom Inline Footer: Actor & Source Details */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 1,
                                  pt: 0.5,
                                  borderTop: '1px solid #F1F5F9',
                                }}
                              >
                                {/* Actor Details */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                  <Avatar
                                    sx={{
                                      width: 18,
                                      height: 18,
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      backgroundColor: roleMeta.color,
                                      color: '#ffffff',
                                    }}
                                  >
                                    {getInitials(formatActorName(log.actor))}
                                  </Avatar>
                                  <Typography
                                    sx={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: '#334155',
                                    }}
                                  >
                                    {formatActorName(log.actor)}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontSize: '10px',
                                      color: '#64748B',
                                      fontWeight: 500,
                                    }}
                                  >
                                    ({roleMeta.label})
                                  </Typography>
                                </Box>

                                {/* Source Device / Portal Badge */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.35,
                                    fontSize: '10px',
                                    color: '#64748B',
                                    backgroundColor: '#F8FAFC',
                                    px: 0.6,
                                    py: 0.15,
                                    borderRadius: '3px',
                                    border: '1px solid #E2E8F0',
                                  }}
                                >
                                  {sourceMeta.icon}
                                  <Typography variant="caption" sx={{ fontSize: '9.5px', fontWeight: 500 }}>
                                    {sourceMeta.label}
                                  </Typography>
                                </Box>
                              </Box>
                            </Paper>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ── FILTER POPOVER (Anchored right below Filter Button) ── */}
      <Popover
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 360,
            maxWidth: '92vw',
            borderRadius: '12px',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.2), 0 4px 12px rgba(15, 23, 42, 0.08)',
            border: '1px solid #E2E8F0',
            fontFamily: '"Montserrat", "Segoe UI", sans-serif',
            overflow: 'hidden',
            mt: 1,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tune sx={{ color: '#17539C', fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>
              Filter Activity Logs
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setFilterAnchorEl(null)} sx={{ width: 26, height: 26 }}>
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        <Divider />

        <Box sx={{ p: 2, maxHeight: 380, overflowY: 'auto' }}>
          {/* Check Type Filter Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', mb: 1 }}>
              Check Type
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              <Chip
                label="All Checks"
                clickable
                size="small"
                onClick={() => setSelectedCheckFilter('ALL')}
                sx={{
                  fontWeight: 600,
                  fontSize: '11px',
                  borderRadius: '5px',
                  backgroundColor: selectedCheckFilter === 'ALL' ? '#17539C' : '#F1F5F9',
                  color: selectedCheckFilter === 'ALL' ? '#FFFFFF' : '#475569',
                  border: `1px solid ${selectedCheckFilter === 'ALL' ? '#17539C' : '#E2E8F0'}`,
                }}
              />
              {availableCheckTypes.map((type) => {
                const meta = getCheckMeta(type);
                const isSelected = selectedCheckFilter.toLowerCase() === type.toLowerCase();
                return (
                  <Chip
                    key={type}
                    label={meta?.label ? `${meta.label} Check` : type}
                    icon={meta?.icon}
                    clickable
                    size="small"
                    onClick={() => setSelectedCheckFilter(isSelected ? 'ALL' : type)}
                    sx={{
                      fontWeight: 600,
                      fontSize: '11px',
                      borderRadius: '5px',
                      backgroundColor: isSelected ? meta?.color || '#17539C' : meta?.bg || '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : meta?.color || '#475569',
                      border: `1px solid ${isSelected ? meta?.color || '#17539C' : meta?.border || '#E2E8F0'}`,
                      '& .MuiChip-icon': {
                        color: isSelected ? '#FFFFFF !important' : `${meta?.color || '#475569'} !important`,
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          {/* Action Category Filter Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', mb: 1 }}>
              Event Category
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {[
                { id: 'ALL', label: 'All Events' },
                { id: 'review', label: 'Verified & Reviews' },
                { id: 'submission', label: 'Check Submissions' },
                { id: 'assignment', label: 'Partner Assignments' },
                { id: 'media', label: 'Evidence & Uploads' },
                { id: 'statement', label: 'Audio Statements' },
                { id: 'status', label: 'Status Updates' },
              ].map((cat) => {
                const isSelected = selectedCategoryFilter === cat.id;
                return (
                  <Chip
                    key={cat.id}
                    label={cat.label}
                    clickable
                    size="small"
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    sx={{
                      fontWeight: 600,
                      fontSize: '11px',
                      borderRadius: '5px',
                      backgroundColor: isSelected ? '#17539C' : '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      border: `1px solid ${isSelected ? '#17539C' : '#E2E8F0'}`,
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          {/* Role Filter Section */}
          {availableRoles.length > 1 && (
            <Box sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', mb: 1 }}>
                Actor Role
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <Chip
                  label="All Roles"
                  clickable
                  size="small"
                  onClick={() => setSelectedRoleFilter('ALL')}
                  sx={{
                    fontWeight: 600,
                    fontSize: '11px',
                    borderRadius: '5px',
                    backgroundColor: selectedRoleFilter === 'ALL' ? '#17539C' : '#F1F5F9',
                    color: selectedRoleFilter === 'ALL' ? '#FFFFFF' : '#475569',
                    border: `1px solid ${selectedRoleFilter === 'ALL' ? '#17539C' : '#E2E8F0'}`,
                  }}
                />
                {availableRoles.map((role) => {
                  const meta = getRoleConfig(role);
                  const isSelected = selectedRoleFilter.toUpperCase() === role.toUpperCase();
                  return (
                    <Chip
                      key={role}
                      label={meta.label}
                      clickable
                      size="small"
                      onClick={() => setSelectedRoleFilter(isSelected ? 'ALL' : role)}
                      sx={{
                        fontWeight: 600,
                        fontSize: '11px',
                        borderRadius: '5px',
                        backgroundColor: isSelected ? meta.color : meta.bg,
                        color: isSelected ? '#FFFFFF' : meta.color,
                        border: `1px solid ${isSelected ? meta.color : meta.border}`,
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        <Divider />

        <Box sx={{ px: 2, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
          <Button
            size="small"
            onClick={handleResetFilters}
            disabled={activeFiltersCount === 0}
            startIcon={<RestartAlt sx={{ fontSize: 15 }} />}
            sx={{
              color: '#64748B',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '11.5px',
            }}
          >
            Reset All
          </Button>

          <Button
            variant="contained"
            size="small"
            onClick={() => setFilterAnchorEl(null)}
            sx={{
              backgroundColor: '#17539C',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              px: 2,
              py: 0.5,
              borderRadius: '6px',
              boxShadow: 'none',
              '&:hover': { backgroundColor: '#0F3A70', boxShadow: 'none' },
            }}
          >
            Apply
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default CaseLogsDrawer;
