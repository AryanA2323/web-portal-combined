import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { theme } from '@/config/theme';
import apiService from '@/services/api';
import { API_BASE_URL } from '@/config/constants';

const PRIMARY_BLUE = theme.colors.primary;

const checkTypeLabels: Record<string, string> = {
  claimant: 'Claimant Check',
  insured: 'Insured Check',
  driver: 'Driver Check',
  spot: 'Spot Check',
  chargesheet: 'Chargesheet',
};

// Fields to display per check type (human-readable labels)
const checkFieldLabels: Record<string, Record<string, string>> = {
  claimant: {
    claimant_name: 'Claimant Name',
    claimant_contact: 'Contact',
    claimant_address: 'Address',
    claimant_income: 'Income',
    statement: 'Statement',
    observation: 'Observation',
  },
  insured: {
    insured_name: 'Insured Name',
    insured_contact: 'Contact',
    insured_address: 'Address',
    policy_number: 'Policy Number',
    policy_period: 'Policy Period',
    rc: 'RC',
    permit: 'Permit',
    statement: 'Statement',
    observation: 'Observation',
  },
  driver: {
    driver_name: 'Driver Name',
    driver_contact: 'Contact',
    driver_address: 'Address',
    dl: 'DL Number',
    permit: 'Permit',
    occupation: 'Occupation',
    statement: 'Statement',
    observation: 'Observation',
  },
  spot: {
    place_of_accident: 'Place of Accident',
    police_station: 'Police Station',
    district: 'District',
    fir_number: 'FIR Number',
    time_of_accident: 'Time of Accident',
    accident_brief: 'Accident Brief',
    observations: 'Observations',
  },
  chargesheet: {
    court_name: 'Court Name',
    fir_number: 'FIR Number',
    mv_act: 'MV Act',
    fir_delay_days: 'FIR Delay Days',
    bsn_section: 'BSN Section',
    ipc: 'IPC',
    statement: 'Statement',
    observations: 'Observations',
  },
};

interface CaseDetailsProps {
  caseId: number;
  checkType: string;
}

export default function CaseDetails({ caseId, checkType }: CaseDetailsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [caseId, checkType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getVendorCheckDetail(caseId, checkType);
      setData(response);
    } catch (err: any) {
      console.error('Failed to load check detail:', err);
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const pickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to upload evidence.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const photos = result.assets.map((asset, i) => ({
      uri: asset.uri,
      name: asset.fileName || `evidence_${Date.now()}_${i}.jpg`,
    }));

    try {
      setUploading(true);
      const res = await apiService.uploadCheckEvidence(caseId, checkType, photos);
      Alert.alert('Success', res.message || 'Evidence uploaded');
      await loadData(); // Refresh to show new evidence
    } catch (err: any) {
      console.error('Upload failed:', err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const photos = result.assets.map((asset, i) => ({
      uri: asset.uri,
      name: asset.fileName || `camera_${Date.now()}_${i}.jpg`,
    }));

    try {
      setUploading(true);
      const res = await apiService.uploadCheckEvidence(caseId, checkType, photos);
      Alert.alert('Success', res.message || 'Evidence uploaded');
      await loadData();
    } catch (err: any) {
      console.error('Upload failed:', err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  const DetailRow = ({ label, value }: { label: string; value: any }) => {
    if (value === null || value === undefined || value === '') return null;
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{String(value)}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'No data available'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const caseInfo = data.case || {};
  const checkInfo = data.check || {};
  const evidencePhotos = checkInfo.evidence_photos || [];
  const fieldLabels = checkFieldLabels[checkType] || {};

  // Build the base URL for media files
  const apiHost = API_BASE_URL.replace('/api', '');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitle}>{checkTypeLabels[checkType] || checkType}</Text>
          <Text style={styles.headerSubtitle}>
            Claim: {caseInfo.claim_number || 'N/A'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Case Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Case Information</Text>
          <DetailRow label="Claim Number" value={caseInfo.claim_number} />
          <DetailRow label="Client Name" value={caseInfo.client_name} />
          <DetailRow label="Category" value={caseInfo.category} />
          <DetailRow label="Case Type" value={caseInfo.case_type} />
          <DetailRow label="Case Status" value={caseInfo.full_case_status} />
          <DetailRow label="SLA" value={caseInfo.sla} />
          <DetailRow label="TAT Days" value={caseInfo.tat_days} />
          <DetailRow label="Receipt Date" value={caseInfo.case_receipt_date} />
          <DetailRow label="Due Date" value={caseInfo.case_due_date} />
          <DetailRow label="Scope of Work" value={caseInfo.scope_of_work} />
          <DetailRow label="IR Status" value={caseInfo.investigation_report_status} />
        </View>

        {/* Check Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🔍 {checkTypeLabels[checkType] || 'Check'} Details
          </Text>
          <DetailRow label="Status" value={checkInfo.check_status} />
          {Object.entries(fieldLabels).map(([field, label]) => (
            <DetailRow key={field} label={label} value={checkInfo[field]} />
          ))}
        </View>

        {/* Evidence Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📸 Evidence Photos ({evidencePhotos.length})</Text>

          {evidencePhotos.length === 0 ? (
            <Text style={styles.noEvidenceText}>No evidence uploaded yet</Text>
          ) : (
            <View style={styles.photosGrid}>
              {evidencePhotos.map((photo: any, idx: number) => (
                <View key={idx} style={styles.photoCard}>
                  <Image
                    source={{ uri: `${apiHost}${photo.url}` }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.photoName} numberOfLines={1}>
                    {photo.filename}
                  </Text>
                  <Text style={styles.photoDate}>
                    {new Date(photo.uploaded_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Upload Buttons */}
        <View style={styles.uploadSection}>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={pickAndUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>📁 Upload from Gallery</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, styles.cameraButton]}
            onPress={takePhoto}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>📷 Take Photo</Text>
            )}
          </TouchableOpacity>
        </View>
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
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: PRIMARY_BLUE,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
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
  noEvidenceText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: '47%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  photoImage: {
    width: '100%',
    height: 120,
  },
  photoName: {
    fontSize: 11,
    color: '#333',
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  photoDate: {
    fontSize: 10,
    color: '#999',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  uploadSection: {
    gap: 12,
    marginTop: 8,
  },
  uploadButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cameraButton: {
    backgroundColor: '#4CAF50',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
