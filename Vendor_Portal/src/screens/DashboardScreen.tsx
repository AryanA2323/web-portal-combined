import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchCases, clearAllCases } from '@/store/casesSlice';
import { logoutUser } from '@/store/authSlice';
import { theme } from '@/config/theme';
import { useRouter } from 'expo-router';

const checkStatusColors: Record<string, string> = {
  'WIP': '#FF9800',
  'Completed': '#4CAF50',
  'Not Initiated': '#9E9E9E',
  'Stop': '#f44336',
};

const checkTypeColors: Record<string, string> = {
  'Claimant Check': '#667eea',
  'Insured Check': '#9f7aea',
  'Driver Check': '#4299e1',
  'Spot Check': '#48bb78',
  'Chargesheet': '#ed8936',
};

export default function DashboardScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { cases: checks, isLoading } = useSelector((state: RootState) => state.cases);

  useEffect(() => {
    if (isAuthenticated && user) {
      dispatch(fetchCases());
    }
  }, [dispatch, isAuthenticated, user]);

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
    }
  };

  const totalChecks = checks.length;
  const wipChecks = checks.filter((c: any) => c.check_status === 'WIP').length;
  const completedChecks = checks.filter((c: any) => c.check_status === 'Completed').length;
  const notInitiated = checks.filter((c: any) => c.check_status === 'Not Initiated').length;

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  const CheckCard = ({ item }: { item: any }) => {
    const statusColor = checkStatusColors[item.check_status] || '#999';
    const typeColor = checkTypeColors[item.check_type] || '#667eea';

    const typeToSlug: Record<string, string> = {
      'Claimant Check': 'claimant',
      'Insured Check': 'insured',
      'Driver Check': 'driver',
      'Spot Check': 'spot',
      'Chargesheet': 'chargesheet',
    };

    const handlePress = () => {
      const slug = typeToSlug[item.check_type] || '';
      router.push({
        pathname: '/case-details',
        params: { caseId: String(item.case_id), checkType: slug },
      });
    };

    return (
      <TouchableOpacity
        style={styles.checkCard}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.checkHeader}>
          <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>
              {item.check_type}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{item.check_status}</Text>
          </View>
        </View>

        <View style={styles.checkDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📋 Claim:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {item.claim_number || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>👤 Client:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {item.client_name || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📁 Category:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {item.category || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.viewDetailsContainer}>
          <Text style={styles.viewDetailsText}>Tap to view details →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.userInfoContainer}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
      >
        {/* Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Assigned Checks</Text>
          <View style={styles.statsGrid}>
            <StatCard title="Total" value={totalChecks} icon="📊" color="#2196F3" />
            <StatCard title="WIP" value={wipChecks} icon="⚡" color="#FF9800" />
            <StatCard title="Not Started" value={notInitiated} icon="⏳" color="#9E9E9E" />
            <StatCard title="Completed" value={completedChecks} icon="✅" color="#4CAF50" />
          </View>
        </View>

        {/* Checks List */}
        <View style={styles.checksContainer}>
          <Text style={styles.sectionTitle}>Your Assigned Checks</Text>
          {isLoading && checks.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading checks...</Text>
            </View>
          ) : checks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No checks assigned yet</Text>
              <Text style={styles.emptySubtext}>
                Checks will appear here when assigned by admin
              </Text>
            </View>
          ) : (
            checks.map((item: any) => (
              <CheckCard key={`${item.case_id}-${item.check_type}`} item={item} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#1976D2',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfoContainer: {
    flex: 1,
    marginRight: 12,
  },
  welcomeText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    flexShrink: 0,
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  checksContainer: {
    marginBottom: 24,
  },
  checkCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  checkDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    minWidth: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  loadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  viewDetailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
