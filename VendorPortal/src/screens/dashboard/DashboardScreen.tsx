// Dashboard Screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { CaseCard, Header } from '../../components/common';
import { COLORS, ROUTES } from '../../utils/constants';
import { DEMO_CASES, DEMO_STATISTICS } from '../../utils/demoData';
import type { Case, CaseStatistics } from '../../types';

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [statistics, setStatistics] = useState<CaseStatistics>({
    new_cases: 0,
    in_progress: 0,
    completed: 0,
    pending_submissions: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Use demo data instead of API calls
      setCases(DEMO_CASES.slice(0, 3)); // Show only recent 3 cases
      setStatistics(DEMO_STATISTICS);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCasePress = (caseItem: Case) => {
    navigation.navigate(ROUTES.CASE_DETAILS as never, { caseId: caseItem.id } as never);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Vendor Portal"
        rightComponent={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS as never)}
              style={styles.iconButton}
            >
              <Text style={styles.bellIcon}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.iconButton}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome, {user?.first_name || 'User'}!</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{statistics.new_cases}</Text>
            <Text style={styles.statLabel}>New Cases</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{statistics.in_progress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{statistics.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {statistics.pending_submissions > 0 && (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              Pending Submissions: {statistics.pending_submissions}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Cases</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate(ROUTES.CASES as never)}
            >
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>

          {cases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              case_item={caseItem}
              onPress={() => handleCasePress(caseItem)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📊</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate(ROUTES.UPLOAD_EVIDENCE as never)}
        >
          <Text style={styles.navIcon}>📤</Text>
          <Text style={styles.navLabel}>Upload Evidence</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate(ROUTES.FORMS as never)}
        >
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>Forms</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  alertBox: {
    backgroundColor: COLORS.warning,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
  },
  alertText: {
    color: COLORS.dark,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
  },
  viewAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 11,
    color: COLORS.gray,
  },
  navLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  bellIcon: {
    fontSize: 24,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  logoutIcon: {
    fontSize: 24,
  },
});

export default DashboardScreen;
