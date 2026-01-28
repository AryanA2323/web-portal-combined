// Cases List Screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CaseCard, Header } from '../../components/common';
import { COLORS, ROUTES } from '../../utils/constants';
import { DEMO_CASES, getDemoCasesByStatus } from '../../utils/demoData';
import type { Case } from '../../types';

const CasesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    filterCases();
  }, [selectedFilter, cases]);

  const loadCases = async () => {
    try {
      // Use demo data
      setCases(DEMO_CASES);
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const filterCases = () => {
    if (selectedFilter === 'all') {
      setFilteredCases(cases);
    } else {
      setFilteredCases(cases.filter(c => c.status === selectedFilter));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCases();
  };

  const handleCasePress = (caseItem: Case) => {
    navigation.navigate(ROUTES.CASE_DETAILS as never, { caseId: caseItem.id } as never);
  };

  return (
    <View style={styles.container}>
      <Header title="Cases" />

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilter === 'all' && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              selectedFilter === 'all' && styles.filterTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilter === 'new' && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedFilter('new')}
        >
          <Text
            style={[
              styles.filterText,
              selectedFilter === 'new' && styles.filterTextActive,
            ]}
          >
            New
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilter === 'in_progress' && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedFilter('in_progress')}
        >
          <Text
            style={[
              styles.filterText,
              selectedFilter === 'in_progress' && styles.filterTextActive,
            ]}
          >
            In Progress
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedFilter === 'completed' && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedFilter('completed')}
        >
          <Text
            style={[
              styles.filterText,
              selectedFilter === 'completed' && styles.filterTextActive,
            ]}
          >
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.casesList}>
          {filteredCases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              case_item={caseItem}
              onPress={() => handleCasePress(caseItem)}
            />
          ))}
          {filteredCases.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No cases found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  content: {
    flex: 1,
  },
  casesList: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
  },
});

export default CasesScreen;
