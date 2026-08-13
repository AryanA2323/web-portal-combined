import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchCases, clearAllCases } from '@/store/casesSlice';
import { logoutUser } from '@/store/authSlice';
import { theme } from '@/config/theme';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '@/services/api';

const checkStatusColors: Record<string, { solid: string; soft: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  WIP: { solid: '#D9822B', soft: '#FFF3E3', icon: 'progress-clock' },
  'Applied for CS': { solid: '#0F5FA8', soft: '#EBF3FA', icon: 'file-document-outline' },
  'CS Recieved to adv': { solid: '#6E59CF', soft: '#F1EFFC', icon: 'file-check-outline' },
  Dispatched: { solid: '#2F7A8E', soft: '#EBF4F6', icon: 'truck-delivery-outline' },
  'not found': { solid: '#D64545', soft: '#FDECEC', icon: 'alert-circle-outline' },
  Completed: { solid: '#2E9B62', soft: '#E9F8F0', icon: 'check-decagram-outline' },
  Verified: { solid: '#2E9B62', soft: '#E9F8F0', icon: 'check-decagram-outline' },
  'Failed': { solid: '#EF4444', soft: '#FEE2E2', icon: 'close-octagon-outline' },
  Reassigned: { solid: '#D64545', soft: '#FDECEC', icon: 'refresh' },
  'Not Initiated': { solid: '#71839A', soft: '#EEF3F8', icon: 'clock-outline' },
  Stop: { solid: '#D64545', soft: '#FDECEC', icon: 'alert-circle-outline' },
};

const checkTypeColors: Record<string, string> = {
  'Claimant Check': '#0F5FA8',
  'Insured Check': '#6E59CF',
  'Driver Check': '#2F7A8E',
  'Spot Check': '#2E9B62',
  Chargesheet: '#C56B1F',
};

const typeToSlug: Record<string, string> = {
  'Claimant Check': 'claimant',
  'Insured Check': 'insured',
  'Driver Check': 'driver',
  'Spot Check': 'spot',
  'Chargesheet': 'chargesheet',
  'Chargesheet Check': 'chargesheet',
  'RTI Check': 'rti',
  'RTO Check': 'rto',
};

export default function DashboardScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const introAnim = useRef(new Animated.Value(0)).current;
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { cases: checks, isLoading } = useSelector((state: RootState) => state.cases);
  const [filterType, setFilterType] = useState<'all' | 'wip' | 'reassigned'>('all');
  
  const activeChecks = useMemo(() => {
    const filtered = checks.filter((c: any) => {
      if (c.check_status === 'Completed' || c.check_status === 'Verified' || c.check_status === 'Failed') return false;
      if (filterType === 'wip' && c.check_status !== 'WIP') return false;
      if (filterType === 'reassigned' && c.check_status !== 'Reassigned') return false;
      return true;
    });

    // Merge insured + driver into single "Insured cum driver" card
    const seenCum = new Set<string>();
    const result: any[] = [];
    for (const c of filtered) {
      if (c.insured_cum_driver) {
        const key = `${c.case_id}`;
        if (seenCum.has(key)) continue;
        seenCum.add(key);
        result.push({ ...c, check_type: 'Insured cum driver' });
      } else {
        result.push(c);
      }
    }
    result.sort((a: any, b: any) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
    return result;
  }, [checks, filterType]);
  
  const [unreadCount, setUnreadCount] = useState(0);

  // Refresh data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user) {
        dispatch(fetchCases());
        fetchUnreadCount();
      }
    }, [dispatch, isAuthenticated, user])
  );

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const interval = setInterval(() => {
      dispatch(fetchCases());
      fetchUnreadCount();
    }, 15000);
    return () => clearInterval(interval);
  }, [dispatch, isAuthenticated, user]);

  // Also refresh when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isAuthenticated && user) {
        dispatch(fetchCases());
        fetchUnreadCount();
      }
    });
    return () => sub.remove();
  }, [dispatch, isAuthenticated, user]);

  const fetchUnreadCount = async () => {
    try {
      const res = await apiService.getVendorNotifications();
      setUnreadCount(res.unread_count || 0);
    } catch (e) {
      // silently ignore
    }
  };

  useEffect(() => {
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [introAnim]);

  const summary = useMemo(() => {
    const totalChecks = checks.length;
    const wipChecks = checks.filter((c: any) => c.check_status === 'WIP').length;
    const completedChecks = checks.filter((c: any) => c.check_status === 'Completed' || c.check_status === 'Verified' || c.check_status === 'Failed').length;
    const reassignedChecks = checks.filter((c: any) => c.check_status === 'Reassigned').length;
    const notInitiated = checks.filter((c: any) => c.check_status === 'Not Initiated').length;
    return { totalChecks, wipChecks, completedChecks, reassignedChecks, notInitiated };
  }, [checks]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await dispatch(clearAllCases());
      await dispatch(logoutUser()).unwrap();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleRefresh = () => {
    if (isAuthenticated && user) {
      dispatch(fetchCases());
      fetchUnreadCount();
    }
  };

  const StatCard = ({
    title,
    value,
    icon,
    color,
    tint,
    onPress,
  }: {
    title: string;
    value: number;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
    tint: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <View style={[styles.statIconWrap, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );

  const CheckCard = ({ item }: { item: any }) => {
    const statusConfig = checkStatusColors[item.check_status] || checkStatusColors['Not Initiated'];
    const typeColor = checkTypeColors[item.check_type] || theme.colors.primary;

    const handlePress = () => {
      const slug = typeToSlug[item.check_type] || (item.check_type ? String(item.check_type).toLowerCase().replace(/ check$/, '') : '');
      router.push(`/case-details?caseId=${item.case_id}&checkType=${slug}` as any);
    };

    return (
      <TouchableOpacity
        style={styles.checkCard}
        onPress={handlePress}
        activeOpacity={0.88}
      >
        <View style={styles.checkHeader}>
          <View style={[styles.typeBadge, { backgroundColor: `${typeColor}14` }]}>
            <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{item.check_type}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.soft }]}>
            <MaterialCommunityIcons name={statusConfig.icon} size={14} color={statusConfig.solid} />
            <Text style={[styles.statusText, { color: statusConfig.solid }]}>{item.check_status}</Text>
          </View>
        </View>

        <View style={styles.claimRow}>
          <Text style={styles.claimNumber}>{item.claim_number || 'No claim number'}</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.textMuted} />
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoPill}>
            <MaterialCommunityIcons name="account-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.infoText} numberOfLines={1}>{item.client_name || 'Client not available'}</Text>
          </View>
          <View style={styles.infoPill}>
            <MaterialCommunityIcons name="folder-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.infoText} numberOfLines={1}>{item.category || 'Category not set'}</Text>
          </View>
        </View>

        <Text style={styles.tapHint}>Open check details, statements, and evidence</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0F5FA8', '#0A4274']} style={styles.hero}>
        <Animated.View
          style={[
            styles.heroContent,
            {
              opacity: introAnim,
              transform: [
                {
                  translateY: introAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.userBlock}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="bell-outline" size={18} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>


        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.statsContainer}>
          <StatCard title="Total" value={summary.totalChecks} icon="clipboard-text-outline" color={theme.colors.primary} tint={theme.colors.primarySoft} onPress={() => setFilterType('all')} />
          <StatCard title="In Progress" value={summary.wipChecks} icon="progress-clock" color={theme.colors.warning} tint={theme.colors.warningSoft} onPress={() => setFilterType(filterType === 'wip' ? 'all' : 'wip')} />
          <StatCard title="Reassigned" value={summary.reassignedChecks} icon="refresh" color={theme.colors.error} tint={theme.colors.errorSoft} onPress={() => setFilterType(filterType === 'reassigned' ? 'all' : 'reassigned')} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Assigned checks</Text>
            <Text style={styles.sectionHint}>Tap a card to record statements or upload evidence.</Text>
          </View>
        </View>

        {isLoading && activeChecks.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.stateTitle}>Loading assigned checks</Text>
            <Text style={styles.stateHint}>Your latest assignments will appear here shortly.</Text>
          </View>
        ) : activeChecks.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="clipboard-search-outline" size={42} color={theme.colors.textMuted} />
            <Text style={styles.stateTitle}>No checks assigned yet</Text>
            <Text style={styles.stateHint}>Once work is assigned by admin, it will show here automatically.</Text>
          </View>
        ) : (
          activeChecks.map((item: any) => (
            <CheckCard key={`${item.case_id}-${item.check_type}`} item={item} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  hero: {
    paddingTop: 58,
    paddingBottom: 34,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroContent: {
    gap: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  userBlock: {
    flex: 1,
  },
  welcomeText: {
    color: '#D9ECFF',
    fontSize: 14,
    marginBottom: 6,
  },
  userName: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#D9ECFF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  heroSummary: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroSummaryLabel: {
    fontSize: 13,
    color: '#D9ECFF',
    marginBottom: 6,
  },
  heroSummaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroSummaryHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#DCEEFF',
  },
  content: {
    flex: 1,
    marginTop: -18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  statCard: {
    width: '31%',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  sectionHint: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  checkCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 1,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  claimNumber: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginRight: 8,
  },
  infoGrid: {
    gap: 10,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceMuted,
  },
  infoText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tapHint: {
    marginTop: 14,
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  stateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 34,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.divider,
    ...theme.shadows.card,
  },
  stateTitle: {
    marginTop: 14,
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  stateHint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
});
