import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/config/theme';
import apiService from '@/services/api';
import { API_BASE_URL } from '@/config/constants';

const PRIMARY_BLUE = theme.colors.primary;
const RECORDING_RED = '#E53935';
const SUCCESS_GREEN = '#4CAF50';
const HEADER_TOP_PADDING = 14;

// Optimized recording settings for speech recognition
// Whisper works best with 16kHz mono audio
const SPEECH_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,  // Whisper is trained on 16kHz
    numberOfChannels: 1,  // Mono for speech
    bitRate: 64000,  // Good quality for speech
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,  // Whisper is trained on 16kHz
    numberOfChannels: 1,  // Mono for speech
    bitRate: 64000,  // Good quality for speech
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

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

const getEvidencePhotoName = (photo: any): string => {
  if (typeof photo === 'string') {
    const parts = photo.split('/');
    return parts[parts.length - 1] || 'evidence.jpg';
  }
  return photo?.filename || photo?.file_name || 'evidence.jpg';
};

const getEvidencePhotoUri = (photo: any, apiHost: string): string => {
  const rawUrl =
    typeof photo === 'string'
      ? photo
      : photo?.preview_url || photo?.url || photo?.photo_url || '';

  if (!rawUrl) return '';

  if (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('file:') ||
    rawUrl.startsWith('content:') ||
    rawUrl.startsWith('data:')
  ) {
    return encodeURI(rawUrl);
  }

  const normalizedPath = rawUrl.startsWith('/')
    ? rawUrl
    : rawUrl.startsWith('media/')
      ? `/${rawUrl}`
      : `/media/${rawUrl}`;

  return encodeURI(`${apiHost}${normalizedPath}`);
};

export default function CaseDetails({ caseId, checkType }: CaseDetailsProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingPhotoName, setDeletingPhotoName] = useState<string | null>(null);

  // Statement Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [transcriptMr, setTranscriptMr] = useState('');
  const [editedTranslation, setEditedTranslation] = useState('');
  const [statementTitle, setStatementTitle] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      // Cleanup recording on unmount
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
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

  // ============== Audio Recording Functions ==============

  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record statements. Please grant permission in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error requesting microphone permission:', err);
      return false;
    }
  };

  const startRecording = async () => {
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) return;

    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording with optimized speech settings
      const { recording } = await Audio.Recording.createAsync(
        SPEECH_RECORDING_OPTIONS
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingUri(null);
      setShowPreview(false);
      setTranscriptMr('');
      setEditedTranslation('');

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      console.log('[Recording] Started');
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      setIsRecording(false);
      setRecordingUri(uri);

      console.log('[Recording] Stopped, URI:', uri);

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsRecording(false);
      Alert.alert('Recording Error', 'Failed to stop recording.');
    } finally {
      recordingRef.current = null;
    }
  };

  const discardRecording = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
    setShowPreview(false);
    setTranscriptMr('');
    setEditedTranslation('');
    setStatementTitle('');
  };

  const processRecording = async () => {
    if (!recordingUri) {
      Alert.alert('No Recording', 'Please record a statement first.');
      return;
    }

    setIsProcessing(true);

    try {
      const filename = `statement_${Date.now()}.m4a`;
      const audioFile = {
        uri: recordingUri,
        name: filename,
        mimeType: 'audio/m4a',
      };

      console.log('[Recording] Processing audio:', audioFile);

      const result = await apiService.previewStatementAudio(caseId, checkType, audioFile);

      if (result.success) {
        setTranscriptMr(result.transcript_mr);
        setEditedTranslation(result.translation_en);
        setShowPreview(true);

        console.log('[Recording] Preview success:', {
          mrLength: result.transcript_mr.length,
          enLength: result.translation_en.length,
        });
      }
    } catch (err: any) {
      console.error('Failed to process recording:', err);
      const errorMsg = err.details?.error || err.message || 'Failed to process audio';
      Alert.alert('Processing Failed', errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyStatement = async () => {
    if (!editedTranslation.trim()) {
      Alert.alert('Empty Statement', 'Please enter a statement before applying.');
      return;
    }

    setIsApplying(true);

    // Prepend title to statement if provided
    const trimmedTitle = statementTitle.trim();
    const trimmedStatement = editedTranslation.trim();
    const finalStatement = trimmedTitle
      ? `${trimmedTitle} - ${trimmedStatement}`
      : trimmedStatement;

    try {
      const result = await apiService.applyStatementText(
        caseId,
        checkType,
        finalStatement,
        transcriptMr
      );

      if (result.success) {
        const savedStatementIndex = result.statement_index || nextStatementIndex || statementCount + 1;
        const totalAllowedStatements = result.max_statements_per_check || maxStatementsPerCheck;
        Alert.alert(
          'Statement Applied',
          `Statement ${savedStatementIndex} of ${totalAllowedStatements} has been saved to the database.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset state and reload data
                discardRecording();
                loadData();
              },
            },
          ]
        );
      }
    } catch (err: any) {
      console.error('Failed to apply statement:', err);
      const errorMsg = err.details?.error || err.message || 'Failed to save statement';
      Alert.alert('Apply Failed', errorMsg);
    } finally {
      setIsApplying(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStatementTimestamp = (value: string): string => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString();
  };

  // ============== Photo Upload Functions ==============

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
      await loadData();
    } catch (err: any) {
      console.error('Upload failed:', err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photo: any) => {
    const photoName = getEvidencePhotoName(photo);
    if (!photoName) {
      Alert.alert('Remove Failed', 'This photo could not be identified.');
      return;
    }

    Alert.alert(
      'Remove Photo',
      'Do you want to remove this evidence photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingPhotoName(photoName);
              await apiService.deleteCheckEvidence(caseId, checkType, photoName);
              await loadData();
            } catch (err: any) {
              console.error('Delete photo failed:', err);
              Alert.alert('Remove Failed', err.message || 'Failed to remove evidence photo');
            } finally {
              setDeletingPhotoName(null);
            }
          },
        },
      ]
    );
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
        <LinearGradient colors={['#0F5FA8', '#0A4274']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check Details</Text>
        </LinearGradient>
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
        <LinearGradient colors={['#0F5FA8', '#0A4274']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check Details</Text>
        </LinearGradient>
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
  const statementEntries = Array.isArray(checkInfo.statement_entries) ? checkInfo.statement_entries : [];
  const statementCount = Number.isFinite(checkInfo.statement_count)
    ? Number(checkInfo.statement_count)
    : statementEntries.length;
  const maxStatementsPerCheck = Number.isFinite(checkInfo.max_statements_per_check)
    ? Number(checkInfo.max_statements_per_check)
    : 3;
  const canAddStatement = typeof checkInfo.can_add_statement === 'boolean'
    ? checkInfo.can_add_statement
    : statementCount < maxStatementsPerCheck;
  const nextStatementIndex = checkInfo.next_statement_index || (canAddStatement ? statementCount + 1 : null);
  const fieldLabels = checkFieldLabels[checkType] || {};

  // Build the base URL for media files
  const apiHost = API_BASE_URL.replace('/api', '');

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0F5FA8', '#0A4274']}
        style={[
          styles.header,
          Platform.OS === 'android' ? { paddingTop: HEADER_TOP_PADDING + insets.top } : null,
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{checkTypeLabels[checkType] || checkType}</Text>
          <Text style={styles.headerSubtitle}>Claim: {caseInfo.claim_number || 'N/A'}</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{checkInfo.check_status || 'Pending'}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Case</Text>
          <Text style={styles.sectionTitle}>Case information</Text>
          <DetailRow label="Claim Number" value={caseInfo.claim_number} />
          <DetailRow label="Client Name" value={caseInfo.client_name} />
          <DetailRow label="Category" value={caseInfo.category} />
          <DetailRow label="Case Type" value={caseInfo.case_type} />
          <DetailRow label="Case Status" value={caseInfo.full_case_status} />
          <DetailRow label="SLA" value={caseInfo.sla} />
          <DetailRow label="TAT Days" value={caseInfo.tat_days} />
          <DetailRow label="Receive Date" value={caseInfo.case_receive_date} />
          <DetailRow label="Due Date" value={caseInfo.case_due_date} />
          <DetailRow label="Scope of Work" value={caseInfo.scope_of_work} />
          <DetailRow label="IR Status" value={caseInfo.investigation_report_status} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Check</Text>
          <Text style={styles.sectionTitle}>{checkTypeLabels[checkType] || 'Check'} details</Text>
          <DetailRow label="Status" value={checkInfo.check_status} />
          {Object.entries(fieldLabels).map(([field, label]) => (
            <DetailRow key={field} label={label} value={checkInfo[field]} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Statement</Text>
          <Text style={styles.sectionTitle}>Record statement in Marathi</Text>
          <Text style={styles.sectionSubtitle}>
            Speak in Marathi. The app will translate it to English for review before saving.
          </Text>
          <View style={styles.counterPill}>
            <MaterialCommunityIcons name="microphone-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.statementCounterText}>
              Stored Statements: {statementCount}/{maxStatementsPerCheck}
            </Text>
          </View>

          {statementEntries.length > 0 && (
            <View style={styles.savedStatementsList}>
              {statementEntries.map((entry: any, idx: number) => (
                <View key={`statement-entry-${idx}`} style={styles.savedStatementCard}>
                  <Text style={styles.savedStatementTitle}>Statement {entry.index || idx + 1}</Text>
                  <Text style={styles.savedStatementText}>{entry.translation_en || ''}</Text>
                  {!!entry.created_at && (
                    <Text style={styles.savedStatementMeta}>
                      Saved: {formatStatementTimestamp(entry.created_at)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {!canAddStatement && (
            <View style={styles.maxStatementBanner}>
              <Text style={styles.maxStatementBannerText}>
                Maximum {maxStatementsPerCheck} statements have been stored for this check.
              </Text>
            </View>
          )}

          {/* Recording Controls */}
          {!showPreview && canAddStatement && (
            <View style={styles.recordingSection}>
              {!isRecording && !recordingUri && (
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={startRecording}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recordButtonIcon}>🎤</Text>
                  <Text style={styles.recordButtonText}>
                    Start Recording {nextStatementIndex ? `(${nextStatementIndex}/${maxStatementsPerCheck})` : ''}
                  </Text>
                </TouchableOpacity>
              )}

              {isRecording && (
                <View style={styles.recordingActive}>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                  </View>
                  <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={stopRecording}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.stopButtonText}>⏹️ Stop Recording</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isRecording && recordingUri && (
                <View style={styles.recordingComplete}>
                  <Text style={styles.recordingCompleteText}>
                    Recording saved ({formatDuration(recordingDuration)})
                  </Text>

                  <View style={styles.recordingActions}>
                    <TouchableOpacity
                      style={styles.reRecordButton}
                      onPress={discardRecording}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.reRecordButtonText}>🔄 Re-record</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.processButton, isProcessing && styles.disabledButton]}
                      onPress={processRecording}
                      disabled={isProcessing}
                      activeOpacity={0.8}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.processButtonText}>Process Recording</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Preview Section */}
          {showPreview && canAddStatement && (
            <View style={styles.previewSection}>
              {/* Statement Title */}
              <View style={styles.translationBox}>
                <Text style={styles.transcriptLabel}>Statement Title (who is giving the statement):</Text>
                <TextInput
                  style={styles.titleInput}
                  value={statementTitle}
                  onChangeText={setStatementTitle}
                  placeholder="e.g. Statement from Vijay Sharma (claimant)"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Marathi Transcript */}
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptLabel}>Marathi Transcript:</Text>
                <Text style={styles.marathiText}>{transcriptMr}</Text>
              </View>

              {/* Editable English Translation */}
              <View style={styles.translationBox}>
                <Text style={styles.transcriptLabel}>English Translation (editable):</Text>
                <TextInput
                  style={styles.translationInput}
                  value={editedTranslation}
                  onChangeText={setEditedTranslation}
                  multiline
                  textAlignVertical="top"
                  placeholder="Edit translation if needed..."
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.discardButton}
                  onPress={discardRecording}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discardButtonText}>Discard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.applyButton, isApplying && styles.disabledButton]}
                  onPress={applyStatement}
                  disabled={isApplying}
                  activeOpacity={0.8}
                >
                  {isApplying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.applyButtonText}>
                      Save Statement {nextStatementIndex || ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Evidence</Text>
          <Text style={styles.sectionTitle}>Evidence photos ({evidencePhotos.length})</Text>

          {evidencePhotos.length === 0 ? (
            <Text style={styles.noEvidenceText}>No evidence uploaded yet</Text>
          ) : (
            <View style={styles.photosGrid}>
              {evidencePhotos.map((photo: any, idx: number) => (
                <View key={`${getEvidencePhotoName(photo)}-${idx}`} style={styles.photoCard}>
                  <View style={styles.photoImageWrapper}>
                    <Image
                      source={{ uri: getEvidencePhotoUri(photo, apiHost) }}
                      style={styles.photoImage}
                      resizeMode="cover"
                      onError={(event) => {
                        console.log('Evidence image failed to load:', {
                          photo,
                          resolvedUri: getEvidencePhotoUri(photo, apiHost),
                          error: event.nativeEvent.error,
                        });
                      }}
                    />
                    <TouchableOpacity
                      style={[
                        styles.removePhotoButton,
                        deletingPhotoName === getEvidencePhotoName(photo) && styles.removePhotoButtonDisabled,
                      ]}
                      onPress={() => handleDeletePhoto(photo)}
                      disabled={deletingPhotoName === getEvidencePhotoName(photo)}
                      activeOpacity={0.8}
                    >
                      {deletingPhotoName === getEvidencePhotoName(photo) ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.removePhotoButtonText}>×</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.photoName} numberOfLines={1}>
                    {getEvidencePhotoName(photo)}
                  </Text>
                  <Text style={styles.photoDate}>
                    {new Date(photo.uploaded_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

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
              <View style={styles.uploadButtonContent}>
                <MaterialCommunityIcons name="image-outline" size={18} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Upload from Gallery</Text>
              </View>
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
              <View style={styles.uploadButtonContent}>
                <MaterialCommunityIcons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Take Photo</Text>
              </View>
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
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#DCEEFF',
    marginTop: 4,
  },
  headerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'flex-start',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 12,
    borderRadius: 14,
    ...theme.shadows.card,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    ...theme.shadows.card,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    marginBottom: 12,
  },
  statementCounterText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  savedStatementsList: {
    gap: 8,
    marginBottom: 14,
  },
  savedStatementCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3e8ef',
    backgroundColor: '#f8fbff',
    padding: 10,
  },
  savedStatementTitle: {
    fontSize: 13,
    color: '#1f3b66',
    fontWeight: '700',
    marginBottom: 6,
  },
  savedStatementText: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 19,
  },
  savedStatementMeta: {
    marginTop: 6,
    fontSize: 11,
    color: '#64748b',
  },
  maxStatementBanner: {
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  maxStatementBannerText: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  // Recording styles
  recordingSection: {
    marginTop: 8,
  },
  recordButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    ...theme.shadows.card,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  recordingActive: {
    alignItems: 'center',
    padding: 22,
    backgroundColor: '#FFF3F3',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: RECORDING_RED,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: RECORDING_RED,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: RECORDING_RED,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  stopButton: {
    backgroundColor: RECORDING_RED,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  recordingComplete: {
    padding: 16,
    backgroundColor: '#F0FFF0',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: SUCCESS_GREEN,
  },
  recordingCompleteText: {
    fontSize: 14,
    color: SUCCESS_GREEN,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reRecordButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reRecordButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  processButton: {
    flex: 2,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  processButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Preview styles
  previewSection: {
    marginTop: 8,
  },
  transcriptBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  transcriptLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  marathiText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  translationBox: {
    marginBottom: 16,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 44,
  },
  translationInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  discardButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  discardButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  applyButton: {
    flex: 2,
    backgroundColor: SUCCESS_GREEN,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Evidence photo styles
  noEvidenceText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: '47%',
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  photoImageWrapper: {
    position: 'relative',
    backgroundColor: '#fff',
  },
  photoImage: {
    width: '100%',
    height: 120,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  removePhotoButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: -1,
  },
  photoName: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  photoDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  uploadSection: {
    gap: 12,
    marginTop: 8,
  },
  uploadButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  cameraButton: {
    backgroundColor: '#2E9B62',
  },
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
