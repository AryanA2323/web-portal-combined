import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/config/theme';

const PRIMARY_BLUE = theme.colors.primary;

interface Case {
  id: number;
  case_number: string;
  title: string;
  description: string;
  status: string;
  assigned_to: number;
  created_at: string;
  updated_at: string;
  priority?: string;
  category?: string;
  claim_number?: string;
  claimant_name?: string;
  insured_name?: string;
  client_code?: string;
  location?: string;
  incident_address?: string;
  incident_city?: string;
  incident_state?: string;
  incident_country?: string;
  incident_postal_code?: string;
  formatted_address?: string;
  latitude?: number;
  longitude?: number;
  assigned_vendor_id?: number;
  assigned_vendor?: string;
  client_id?: number;
  created_by_id?: number;
  resolved_at?: string;
  closed_at?: string;
  source?: string;
  workflow_type?: string;
  investigation_progress?: number;
}

interface CaseDetailsProps {
  caseItem?: Case;
}

export default function CaseDetails({ caseItem }: CaseDetailsProps) {
  const router = useRouter();

  if (!caseItem) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Case Details</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>No case data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleUploadEvidence = () => {
    router.push({
      pathname: '/upload-evidence',
      params: { case: JSON.stringify(caseItem) }
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const DetailRow = ({ label, value }: { label: string; value: string | number | undefined }) => {
    if (!value && value !== 0) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  };

  const getStatusColor = (status: string) => {
    const statusColors: any = {
      'OPEN': '#FF9800',
      'IN_PROGRESS': '#2196F3',
      'RESOLVED': '#4CAF50',
      'CLOSED': '#9E9E9E',
      'active': '#4CAF50',
      'pending': '#FF9800',
      'completed': '#2196F3',
    };
    return statusColors[status] || '#999';
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return '#9E9E9E';
    const priorityColors: any = {
      'HIGH': '#f44336',
      'MEDIUM': '#FF9800',
      'LOW': '#4CAF50',
    };
    return priorityColors[priority.toUpperCase()] || '#9E9E9E';
  };

  const getLocationText = () => {
    if (caseItem.formatted_address) {
      return caseItem.formatted_address;
    }
    const parts = [
      caseItem.incident_address,
      caseItem.incident_city,
      caseItem.incident_state,
      caseItem.incident_postal_code,
      caseItem.incident_country
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitle}>Case Details</Text>
          <Text style={styles.headerSubtitle}>{caseItem.case_number}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Case Title and Status */}
        <View style={styles.titleSection}>
          <Text style={styles.caseTitle}>{caseItem.title}</Text>
          <View style={styles.badgesContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(caseItem.status) }]}>
              <Text style={styles.badgeText}>{caseItem.status.toUpperCase()}</Text>
            </View>
            {caseItem.priority && (
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(caseItem.priority) }]}>
                <Text style={styles.badgeText}>{caseItem.priority.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Basic Information</Text>
          <DetailRow label="Case Number" value={caseItem.case_number} />
          <DetailRow label="Category" value={caseItem.category} />
          <DetailRow label="Claim Number" value={caseItem.claim_number} />
          <DetailRow label="Source" value={caseItem.source} />
          <DetailRow label="Workflow Type" value={caseItem.workflow_type} />
          {caseItem.investigation_progress !== undefined && (
            <DetailRow label="Investigation Progress" value={`${caseItem.investigation_progress}%`} />
          )}
        </View>

        {/* Description */}
        {caseItem.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Description</Text>
            <Text style={styles.descriptionText}>{caseItem.description}</Text>
          </View>
        )}

        {/* Parties Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Parties</Text>
          <DetailRow label="Claimant Name" value={caseItem.claimant_name} />
          <DetailRow label="Insured Name" value={caseItem.insured_name} />
          <DetailRow label="Client Code" value={caseItem.client_code} />
          <DetailRow label="Assigned Vendor" value={caseItem.assigned_vendor} />
        </View>

        {/* Location Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Location Information</Text>
          <Text style={styles.locationText}>{getLocationText()}</Text>
          {caseItem.latitude && caseItem.longitude && (
            <View style={styles.coordinatesContainer}>
              <Text style={styles.coordinatesText}>
                Coordinates: {caseItem.latitude.toFixed(6)}, {caseItem.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Timeline</Text>
          <DetailRow label="Created At" value={formatDate(caseItem.created_at)} />
          <DetailRow label="Updated At" value={formatDate(caseItem.updated_at)} />
          {caseItem.resolved_at && (
            <DetailRow label="Resolved At" value={formatDate(caseItem.resolved_at)} />
          )}
          {caseItem.closed_at && (
            <DetailRow label="Closed At" value={formatDate(caseItem.closed_at)} />
          )}
        </View>

        {/* Upload Evidence Button */}
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={handleUploadEvidence}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadButtonText}>📤 Upload Evidence</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: PRIMARY_BLUE,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  titleSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  caseTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '400',
    flex: 2,
    textAlign: 'right',
  },
  descriptionText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  locationText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  coordinatesContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  coordinatesText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'monospace',
  },
  uploadButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
});
