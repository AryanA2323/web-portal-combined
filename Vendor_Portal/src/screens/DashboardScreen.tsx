import React, { useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCases } from '@/store/casesSlice';
import { logoutUser } from '@/store/authSlice';
import { Card, Button } from '@/components/CommonComponents';
import { theme } from '@/config/theme';
import { RootState, AppDispatch } from '@/store';
import { Case } from '@/types';

interface DashboardScreenProps {
  onLogout?: () => void;
  onCasePress?: (caseId: number) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onLogout,
  onCasePress,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { cases, isLoading, error } = useSelector(
    (state: RootState) => state.cases
  );
  const [statistics, setStatistics] = React.useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      // Fetch vendor-specific cases
      const result = await dispatch(fetchCases()).unwrap();
      // Extract statistics from response
      if (result.statistics) {
        setStatistics(result.statistics);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'open':
        return theme.colors.info;
      case 'in_progress':
        return theme.colors.warning;
      case 'resolved':
        return theme.colors.success;
      case 'closed':
        return theme.colors.textSecondary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderCaseItem = ({ item }: { item: Case }) => (
    <TouchableOpacity
      onPress={() => onCasePress?.(item.id)}
      activeOpacity={0.7}
    >
      <Card style={styles.caseCard}>
        <View style={styles.caseHeader}>
          <View style={styles.caseNumberContainer}>
            <Text style={styles.caseNumber}>{item.case_number}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.caseTitle}>{item.title}</Text>

        {item.description && (
          <Text style={styles.caseDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.caseFooter}>
          <Text style={styles.dateText}>
            {formatDate(item.created_at)}
          </Text>
          {item.priority && (
            <Text style={styles.priorityText}>
              Priority: {item.priority}
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No cases assigned yet</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.dashboardHeader}>
      <View>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.name || 'Vendor'}</Text>
      </View>
      <Button
        title="Logout"
        onPress={handleLogout}
        variant="secondary"
        style={styles.logoutButton}
        textStyle={styles.logoutButtonText}
      />
    </View>
  );

  const renderStatistics = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics.total}</Text>
          <Text style={styles.statLabel}>Total Cases</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#E8F4F8' }]}>
          <Text style={[styles.statValue, { color: '#0288D1' }]}>
            {statistics.open}
          </Text>
          <Text style={styles.statLabel}>Open</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
          <Text style={[styles.statValue, { color: '#F57C00' }]}>
            {statistics.in_progress}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
          <Text style={[styles.statValue, { color: '#388E3C' }]}>
            {statistics.resolved}
          </Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>
    </View>
  );

  const renderCasesHeader = () => (
    <View style={styles.casesHeaderContainer}>
      <Text style={styles.casesTitle}>Assigned Cases</Text>
      <Text style={styles.casesCount}>
        {cases.length} case{cases.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );

  if (isLoading && cases.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={cases}
        renderItem={renderCaseItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={() => (
          <>
            {renderHeader()}
            {renderStatistics()}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}
            {renderCasesHeader()}
          </>
        )}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadCases}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        scrollEnabled={cases.length > 0}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  welcomeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  logoutButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minWidth: 80,
  },
  logoutButtonText: {
    fontSize: 12,
  },
  statsContainer: {
    marginBottom: theme.spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    marginHorizontal: theme.spacing.xs,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorBannerText: {
    color: theme.colors.surface,
    fontSize: 12,
  },
  casesHeaderContainer: {
    marginBottom: theme.spacing.md,
  },
  casesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  casesCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  caseCard: {
    marginBottom: theme.spacing.md,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  caseNumberContainer: {
    flex: 1,
  },
  caseNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  caseDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    lineHeight: 18,
  },
  caseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  priorityText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});

export default DashboardScreen;
