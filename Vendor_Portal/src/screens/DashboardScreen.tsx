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

export default function DashboardScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { cases, isLoading } = useSelector((state: RootState) => state.cases);

  // If not authenticated, return null - navigation is handled by _layout.tsx
  if (!isAuthenticated || !user) {
    return null;
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      dispatch(fetchCases());
    }
  }, [dispatch, isAuthenticated, user]);

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

  const totalCases = cases.length;
  const activeCases = cases.filter((c) => c.status === 'active').length;
  const completedCases = cases.filter((c) => c.status === 'completed').length;
  const pendingCases = cases.filter((c) => c.status === 'pending').length;

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  const CaseCard = ({ caseItem }: any) => {
    const statusColors: any = {
      active: '#4CAF50',
      pending: '#FF9800',
      completed: '#2196F3',
    };

    const handleCasePress = () => {
      router.push({
        pathname: '/case-details',
        params: { case: JSON.stringify(caseItem) }
      });
    };

    return (
      <TouchableOpacity 
        style={styles.caseCard}
        onPress={handleCasePress}
        activeOpacity={0.7}
      >
        <View style={styles.caseHeader}>
          <Text style={styles.caseTitle} numberOfLines={2}>
            {caseItem.title || `Case #${caseItem.id}`}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors[caseItem.status] || '#999' },
            ]}
          >
            <Text style={styles.statusText}>
              {caseItem.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.caseDetails}>
          <View style={styles.caseDetailRow}>
            <Text style={styles.caseLabel}>📍 Location:</Text>
            <Text style={styles.caseValue} numberOfLines={1}>
              {caseItem.formatted_address || 
               [caseItem.incident_address, caseItem.incident_city, caseItem.incident_state]
                 .filter(Boolean)
                 .join(', ') || 
               'N/A'}
            </Text>
          </View>
          <View style={styles.caseDetailRow}>
            <Text style={styles.caseLabel}>📅 Date:</Text>
            <Text style={styles.caseValue}>
              {new Date(caseItem.createdAt).toLocaleDateString()}
            </Text>
          </View>
          {caseItem.description && (
            <View style={styles.caseDetailRow}>
              <Text style={styles.caseLabel}>📝 Description:</Text>
              <Text style={styles.caseValue} numberOfLines={2}>
                {caseItem.description}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.viewDetailsContainer}>
          <Text style={styles.viewDetailsText}>Tap to view details →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with gradient background */}
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
        {/* Statistics Grid */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Case Statistics</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Cases"
              value={totalCases}
              icon="📊"
              color="#2196F3"
            />
            <StatCard
              title="Active"
              value={activeCases}
              icon="⚡"
              color="#4CAF50"
            />
            <StatCard
              title="Pending"
              value={pendingCases}
              icon="⏳"
              color="#FF9800"
            />
            <StatCard
              title="Completed"
              value={completedCases}
              icon="✅"
              color="#9C27B0"
            />
          </View>
        </View>

        {/* Cases List */}
        <View style={styles.casesContainer}>
          <Text style={styles.sectionTitle}>Your Cases</Text>
          {isLoading && cases.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading cases...</Text>
            </View>
          ) : cases.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No cases assigned yet</Text>
              <Text style={styles.emptySubtext}>
                New cases will appear here when assigned
              </Text>
            </View>
          ) : (
            cases.map((caseItem) => <CaseCard key={caseItem.id} caseItem={caseItem} />)
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
  casesContainer: {
    marginBottom: 24,
  },
  caseCard: {
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
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  caseTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 12,
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
  caseDetails: {
    gap: 8,
  },
  caseDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  caseLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    minWidth: 100,
  },
  caseValue: {
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
