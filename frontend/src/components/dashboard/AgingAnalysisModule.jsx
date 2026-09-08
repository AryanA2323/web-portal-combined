import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ErrorOutline as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

const customScrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '6px',
    height: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#f8fafc',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#cbd5e1',
    borderRadius: '4px',
    '&:hover': {
      background: '#94a3b8',
    },
  },
};

const AgingAnalysisModule = ({ data, loading }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('BEYOND'); // 'BEYOND', 'APPROACHING', or 'WITHIN'

  const totalActive = data?.total_active ?? 0;
  const beyondTat = data?.beyond_tat || { count: 0, percentage: 0, cases: [] };
  const approachingTat = data?.approaching_tat || { count: 0, percentage: 0, cases: [] };
  const withinTat = data?.within_tat || { count: 0, percentage: 0, cases: [] };

  const handleCaseClick = (caseItem) => {
    if (caseItem?.id) {
      navigate(`/case_manager/cases?openCaseId=${caseItem.id}`, {
        state: { openCaseId: caseItem.id },
      });
    }
  };

  const renderSingleBucketRow = (c, bucketType) => {
    let badgeBg = '#fee2e2';
    let badgeColor = '#b91c1c';
    let cardBg = '#fff5f5';
    let cardBorder = '#fee2e2';
    let cardHoverBorder = '#fca5a5';
    let cardHoverBg = '#fef2f2';

    if (bucketType === 'APPROACHING') {
      badgeBg = '#fef3c7';
      badgeColor = '#b45309';
      cardBg = '#fffdf5';
      cardBorder = '#fef3c7';
      cardHoverBorder = '#fde68a';
      cardHoverBg = '#fffbeb';
    } else if (bucketType === 'WITHIN') {
      badgeBg = '#dcfce7';
      badgeColor = '#15803d';
      cardBg = '#f6fdf8';
      cardBorder = '#dcfce7';
      cardHoverBorder = '#86efac';
      cardHoverBg = '#f0fdf4';
    }

    return (
      <Paper
        key={c.id}
        elevation={0}
        onClick={() => handleCaseClick(c)}
        sx={{
          p: 1.5,
          px: 2,
          borderRadius: '12px',
          bgcolor: cardBg,
          border: `1px solid ${cardBorder}`,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          '&:hover': {
            borderColor: cardHoverBorder,
            bgcolor: cardHoverBg,
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: '13.5px',
              fontWeight: 700,
              color: '#1e3a8a',
              whiteSpace: 'nowrap',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {c.case_number || `Case #${c.id}`}
          </Typography>

          {c.investigation_type && (
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: '12px',
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                fontSize: '11px',
                fontWeight: 600,
                color: '#475569',
                whiteSpace: 'nowrap',
              }}
            >
              {c.investigation_type}
            </Box>
          )}

          <Typography
            sx={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {c.client_name || 'No Client Specified'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Box
            sx={{
              px: 1.25,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: badgeBg,
              color: badgeColor,
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {c.status_text}
          </Box>
        </Box>
      </Paper>
    );
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
      }}
    >
      {/* ── 1. Module Header ────────────────────────────────────────────── */}
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
            <AccessTimeIcon sx={{ fontSize: 24 }} />
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
              Aging Analysis & TAT Health
            </Typography>
            <Typography
              sx={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#64748b',
                mt: 0.3,
              }}
            >
              Turnaround Time distribution across active cases
            </Typography>
          </Box>
        </Box>

        {/* Right side: Total Active Badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
          <Chip
            label={`Total Active: ${totalActive} Cases`}
            sx={{
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#1e293b',
              fontWeight: 700,
              fontSize: '12px',
              height: '32px',
              borderRadius: '10px',
            }}
          />
        </Box>
      </Box>

      {/* ── 2. Horizontal TAT Spectrum Graph ─────────────────────────────── */}
      <Box sx={{ mb: 3.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
            Horizontal TAT Spectrum Graph
          </Typography>
          <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b' }}>
            Active Breakdown (Count)
          </Typography>
        </Box>

        {/* Stacked Proportional Bar */}
        <Box
          sx={{
            width: '100%',
            height: 24,
            borderRadius: '12px',
            bgcolor: '#f1f5f9',
            overflow: 'hidden',
            display: 'flex',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {totalActive === 0 ? (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                No active cases to display
              </Typography>
            </Box>
          ) : (
            <>
              {beyondTat.count > 0 && (
                <Tooltip title={`Beyond TAT: ${beyondTat.count} cases (${beyondTat.percentage}%) - Click to view`}>
                  <Box
                    onClick={() => setActiveTab('BEYOND')}
                    sx={{
                      width: `${beyondTat.percentage}%`,
                      height: '100%',
                      bgcolor: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      px: 0.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { filter: 'brightness(1.1)' },
                    }}
                  >
                    {beyondTat.percentage > 7 ? `${beyondTat.count} cases` : `${beyondTat.count}`}
                  </Box>
                </Tooltip>
              )}

              {approachingTat.count > 0 && (
                <Tooltip title={`Approaching TAT: ${approachingTat.count} cases (${approachingTat.percentage}%) - Click to view`}>
                  <Box
                    onClick={() => setActiveTab('APPROACHING')}
                    sx={{
                      width: `${approachingTat.percentage}%`,
                      height: '100%',
                      bgcolor: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      px: 0.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { filter: 'brightness(1.1)' },
                    }}
                  >
                    {approachingTat.percentage > 7 ? `${approachingTat.count} cases` : `${approachingTat.count}`}
                  </Box>
                </Tooltip>
              )}

              {withinTat.count > 0 && (
                <Tooltip title={`Within TAT: ${withinTat.count} cases (${withinTat.percentage}%) - Click to view`}>
                  <Box
                    onClick={() => setActiveTab('WITHIN')}
                    sx={{
                      width: `${withinTat.percentage}%`,
                      height: '100%',
                      bgcolor: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      px: 0.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { filter: 'brightness(1.1)' },
                    }}
                  >
                    {withinTat.percentage > 7 ? `${withinTat.count} cases` : `${withinTat.count}`}
                  </Box>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* ── 3. Tabbed View ───────────────────────────────────────────────── */}
      <Box sx={{ width: '100%' }}>
        {/* Tab Selector Buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <Box
            onClick={() => setActiveTab('BEYOND')}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: '13px',
              fontWeight: 700,
              border: '1.5px solid',
              borderColor: activeTab === 'BEYOND' ? '#d32f2f' : '#fecaca',
              bgcolor: activeTab === 'BEYOND' ? '#d32f2f' : '#ffffff',
              color: activeTab === 'BEYOND' ? '#ffffff' : '#b71c1c',
              boxShadow: activeTab === 'BEYOND' ? '0 4px 12px rgba(211, 47, 47, 0.25)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 18 }} />
            <span>Beyond TAT ({beyondTat.count})</span>
          </Box>

          <Box
            onClick={() => setActiveTab('APPROACHING')}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: '13px',
              fontWeight: 700,
              border: '1.5px solid',
              borderColor: activeTab === 'APPROACHING' ? '#ed6c02' : '#fed7aa',
              bgcolor: activeTab === 'APPROACHING' ? '#ed6c02' : '#ffffff',
              color: activeTab === 'APPROACHING' ? '#ffffff' : '#c2410c',
              boxShadow: activeTab === 'APPROACHING' ? '0 4px 12px rgba(237, 108, 2, 0.25)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <AccessTimeIcon sx={{ fontSize: 18 }} />
            <span>Approaching TAT ({approachingTat.count})</span>
          </Box>

          <Box
            onClick={() => setActiveTab('WITHIN')}
            sx={{
              px: 2,
              py: 1,
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: '13px',
              fontWeight: 700,
              border: '1.5px solid',
              borderColor: activeTab === 'WITHIN' ? '#2e7d32' : '#bbf7d0',
              bgcolor: activeTab === 'WITHIN' ? '#2e7d32' : '#ffffff',
              color: activeTab === 'WITHIN' ? '#ffffff' : '#1b5e20',
              boxShadow: activeTab === 'WITHIN' ? '0 4px 12px rgba(46, 125, 50, 0.25)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 18 }} />
            <span>Within TAT ({withinTat.count})</span>
          </Box>
        </Box>

        {/* Tab Content List */}
        <Box
          sx={{
            maxHeight: 380,
            minHeight: 160,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            p: 0.5,
            ...customScrollbarStyles,
          }}
        >
          {activeTab === 'BEYOND' && (
            beyondTat.cases && beyondTat.cases.length > 0 ? (
              beyondTat.cases.map((c) => renderSingleBucketRow(c, 'BEYOND'))
            ) : (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                  No cases beyond TAT
                </Typography>
              </Box>
            )
          )}

          {activeTab === 'APPROACHING' && (
            approachingTat.cases && approachingTat.cases.length > 0 ? (
              approachingTat.cases.map((c) => renderSingleBucketRow(c, 'APPROACHING'))
            ) : (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                  No cases approaching TAT
                </Typography>
              </Box>
            )
          )}

          {activeTab === 'WITHIN' && (
            withinTat.cases && withinTat.cases.length > 0 ? (
              withinTat.cases.map((c) => renderSingleBucketRow(c, 'WITHIN'))
            ) : (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                  No cases within TAT
                </Typography>
              </Box>
            )
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default AgingAnalysisModule;
