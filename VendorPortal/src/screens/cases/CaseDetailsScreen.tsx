// Case Details Screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Header, Button } from '../../components/common';
import { COLORS, ROUTES, CASE_TYPES, STATUS_COLORS } from '../../utils/constants';
import { getDemoCaseById } from '../../utils/demoData';
import type { Case } from '../../types';

const CaseDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { caseId } = route.params as { caseId: number };
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaseDetails();
  }, [caseId]);

  const loadCaseDetails = async () => {
    try {
      // Use demo data
      const data = getDemoCaseById(caseId);
      setCaseData(data || null);
    } catch (error) {
      console.error('Error loading case details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !caseData) {
    return (
      <View style={styles.container}>
        <Header
          title="Case Details"
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[caseData.status] || COLORS.gray;

  return (
    <View style={styles.container}>
      <Header
        title="Case Details"
        showBack
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.caseTitle}>{CASE_TYPES[caseData.case_type as keyof typeof CASE_TYPES]}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{caseData.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Case Number" value={caseData.case_number} />
          <InfoRow label="Assigned Date" value={formatDate(caseData.assigned_date)} />
          <InfoRow label="Status" value={caseData.status.replace('_', ' ')} />
          <InfoRow label="Location" value={caseData.location} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{caseData.description}</Text>
        </View>

        {/* Map Placeholder */}
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapIcon}>🗺️</Text>
            <Text style={styles.mapText}>Map Location</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Button
            title="📷 Add Photos"
            onPress={() =>
              navigation.navigate(ROUTES.UPLOAD_PHOTOS as never, { caseId } as never)
            }
            variant="primary"
            style={styles.actionButton}
          />
          <Button
            title="✍️ Fill Report"
            onPress={() =>
              navigation.navigate(ROUTES.FILL_REPORT as never, { caseId } as never)
            }
            variant="success"
            style={styles.actionButton}
          />
          <Button
            title="📄 Generate Form"
            onPress={() =>
              navigation.navigate(ROUTES.GENERATE_FORM as never, { caseId } as never)
            }
            variant="warning"
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  headerSection: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  caseTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.white,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.dark,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.dark,
    lineHeight: 20,
  },
  mapContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  mapText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    marginBottom: 0,
  },
  settingsIcon: {
    fontSize: 24,
  },
});

export default CaseDetailsScreen;
