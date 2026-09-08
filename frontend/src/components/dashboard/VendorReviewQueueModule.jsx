import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  VerifiedUser as VerifiedUserIcon,
  ChevronRight as ChevronRightIcon,
  AccessTimeRounded as AccessTimeIcon,
  PriorityHighRounded as PriorityHighIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';

const VendorReviewQueueModule = ({ data, loading }) => {
  const navigate = useNavigate();

  const totalPendingChecks = data?.total_pending_checks ?? 0;
  const immediateAttentionCount = data?.immediate_attention_count ?? 0;
  const beyondTatCount = data?.beyond_tat_count ?? 0;
  const approachingTatCount = data?.approaching_tat_count ?? 0;
  const withinTatCount = data?.within_tat_count ?? data?.normal_count ?? 0;
  const totalPendingReviews = data?.total_pending_reviews ?? 0;
  const topReviews = data?.top_reviews || [];

  const handleCaseClick = (caseItem) => {
    if (caseItem?.id) {
      navigate(`/case_manager/cases?expandCaseId=${caseItem.id}`, {
        state: { expandCaseId: caseItem.id, caseNumber: caseItem.case_number },
      });
    }
  };

  const handleViewAllClick = () => {
    navigate('/case_manager/cases?status=pending_review&review_pending=true');
  };

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case 'Beyond TAT':
        return {
          bgcolor: '#fee2e2',
          color: '#dc2626',
          dotColor: '#ef4444',
          label: 'Beyond TAT',
        };
      case 'Approaching TAT':
        return {
          bgcolor: '#fef3c7',
          color: '#d97706',
          dotColor: '#f59e0b',
          label: 'Approaching TAT',
        };
      case 'Within TAT':
      case 'Normal':
      default:
        return {
          bgcolor: '#dcfce7',
          color: '#16a34a',
          dotColor: '#22c55e',
          label: status === 'Normal' ? 'Normal' : 'Within TAT',
        };
    }
  };

  const getTatBadgeStyles = (status) => {
    switch (status) {
      case 'Beyond TAT':
        return {
          bgcolor: '#fee2e2',
          color: '#dc2626',
          iconColor: '#dc2626',
        };
      case 'Approaching TAT':
        return {
          bgcolor: '#fef3c7',
          color: '#d97706',
          iconColor: '#d97706',
        };
      case 'Within TAT':
      case 'Normal':
      default:
        return {
          bgcolor: '#dcfce7',
          color: '#16a34a',
          iconColor: '#16a34a',
        };
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        borderRadius: '20px',
        bgcolor: '#ffffff',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 4px 24px rgba(99, 102, 241, 0.04)',
        p: { xs: 2.5, sm: 3, md: 3.5 },
        mt: { xs: 3, md: 3.5 },
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Box>
        {/* ── 1. Header ──────────────────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                bgcolor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <VerifiedUserIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.05rem', md: '1.2rem' },
                  color: '#0f172a',
                  lineHeight: 1.2,
                  letterSpacing: '-0.3px',
                }}
              >
                Case Reviews
              </Typography>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#64748b',
                  mt: 0.3,
                }}
              >
                {`${totalPendingChecks} checks pending · ${immediateAttentionCount} require immediate attention`}
              </Typography>
            </Box>
          </Box>

          {/* Right side: View all button */}
          <Button
            onClick={handleViewAllClick}
            endIcon={<ChevronRightIcon sx={{ fontSize: '18px !important', ml: -0.5 }} />}
            sx={{
              bgcolor: '#eff6ff',
              color: '#2563eb',
              borderRadius: '9999px',
              border: '1px solid #dbeafe',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13px',
              px: 2,
              py: 0.6,
              boxShadow: 'none',
              alignSelf: { xs: 'flex-end', sm: 'center' },
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: '#dbeafe',
                borderColor: '#bfdbfe',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)',
              },
            }}
          >
            {`View all ${totalPendingReviews || totalPendingChecks}`}
          </Button>
        </Box>

        {/* ── 2. Three Metric Pill Cards ───────────────────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(3, 1fr)',
            },
            gap: 1.5,
            mb: 3,
          }}
        >
          {/* 1. Beyond TAT */}
          <Paper
            elevation={0}
            sx={{
              p: 1.75,
              borderRadius: '16px',
              bgcolor: '#fef2f2',
              border: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#fca5a5',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)',
              },
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                bgcolor: '#ef4444',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
              }}
            >
              <PriorityHighIcon sx={{ fontSize: 20, fontWeight: 900 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', lineHeight: 1.1 }}>
                  {beyondTatCount}
                </Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', lineHeight: 1.1 }}>
                  Beyond TAT
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 500, color: '#991b1b', mt: 0.3 }}>
                {'Past TAT date'}
              </Typography>
            </Box>
          </Paper>

          {/* 2. Approaching TAT */}
          <Paper
            elevation={0}
            sx={{
              p: 1.75,
              borderRadius: '16px',
              bgcolor: '#fffbeb',
              border: '1px solid #fef3c7',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#fde68a',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)',
              },
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                bgcolor: '#f59e0b',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
              }}
            >
              <AccessTimeIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#d97706', lineHeight: 1.1 }}>
                  {approachingTatCount}
                </Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#d97706', lineHeight: 1.1 }}>
                  Approaching TAT
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 500, color: '#b45309', mt: 0.3 }}>
                {'≤ 3 days before TAT'}
              </Typography>
            </Box>
          </Paper>

          {/* 3. Within TAT */}
          <Paper
            elevation={0}
            sx={{
              p: 1.75,
              borderRadius: '16px',
              bgcolor: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#bfdbfe',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
              },
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                bgcolor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
              }}
            >
              <DotIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', lineHeight: 1.1 }}>
                  {withinTatCount}
                </Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', lineHeight: 1.1 }}>
                  Within TAT
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 500, color: '#1d4ed8', mt: 0.3 }}>
                {'> 3 days before TAT'}
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* ── 3. Top Pending Reviews Section ───────────────────────────────────── */}
        <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
            Top Pending Reviews
          </Typography>
          <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>
            {`Showing ${Math.min(5, topReviews.length)} of ${totalPendingReviews || topReviews.length}`}
          </Typography>
        </Box>

        {/* ── 4. Table Header ─────────────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '130px 140px 1fr 60px 100px 30px',
              sm: '130px 150px 1fr 70px 110px 30px',
            },
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1,
            borderBottom: '1px solid #f1f5f9',
            mb: 0.5,
          }}
        >
          <Box />
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>
            CASE ID
          </Typography>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>
            VENDOR
          </Typography>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textAlign: 'center' }}>
            CHECKS
          </Typography>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>
            TAT
          </Typography>
          <Box />
        </Box>

        {/* ── 5. Table Rows ───────────────────────────────────────────────────── */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 5 }}>
            <CircularProgress size={30} thickness={4} sx={{ color: '#2563eb' }} />
          </Box>
        ) : topReviews.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <Typography sx={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
              No pending reviews at the moment
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {topReviews.slice(0, 5).map((row) => {
              const statusBadge = getStatusBadgeStyles(row.tat_status);
              const tatBadge = getTatBadgeStyles(row.tat_status);

              return (
                <Box
                  key={row.id}
                  onClick={() => handleCaseClick(row)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '130px 140px 1fr 60px 100px 30px',
                      sm: '130px 150px 1fr 70px 110px 30px',
                    },
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1.1,
                    borderRadius: '12px',
                    bgcolor: '#ffffff',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: '#f8fafc',
                      borderColor: '#e2e8f0',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  {/* 1. Status Badge */}
                  <Box>
                    <Box
                      sx={{
                        bgcolor: statusBadge.bgcolor,
                        color: statusBadge.color,
                        borderRadius: '9999px',
                        px: 1.25,
                        py: 0.35,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: statusBadge.dotColor,
                          flexShrink: 0,
                        }}
                      />
                      {statusBadge.label}
                    </Box>
                  </Box>

                  {/* 2. Case ID */}
                  <Tooltip title="Click to view case">
                    <Typography
                      sx={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#2563eb',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {row.case_number}
                    </Typography>
                  </Tooltip>

                  {/* 3. Vendor */}
                  <Typography
                    sx={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#334155',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.vendor_name || '—'}
                  </Typography>

                  {/* 4. Checks */}
                  <Typography
                    sx={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#475569',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.checks_display || `${row.checks_submitted}/${row.total_checks}`}
                  </Typography>

                  {/* 5. TAT */}
                  <Box>
                    <Box
                      sx={{
                        bgcolor: tatBadge.bgcolor,
                        color: tatBadge.color,
                        borderRadius: '9999px',
                        px: 1.2,
                        py: 0.35,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <AccessTimeIcon sx={{ fontSize: 13, color: tatBadge.iconColor }} />
                      {row.tat_text}
                    </Box>
                  </Box>

                  {/* 6. Chevron Right */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ChevronRightIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default VendorReviewQueueModule;
