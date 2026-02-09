import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  Image,
  Alert,
  ActivityIndicator 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { theme } from '@/config/theme';
import apiService from '@/services/api';

const PRIMARY_BLUE = theme.colors.primary;

interface PhotoData {
  uri: string;
  name: string;
  lat?: string;
  long?: string;
}

interface ExistingPhoto {
  id: number;
  file_name: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  uploaded_at: string;
}

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
  location?: string;
}

interface RootStackParamList {
  UploadEvidence: { caseItem?: Case };
  Incident: undefined;
}

interface UploadEvidenceProps {
  caseItem?: Case;
}

export default function UploadEvidence({ caseItem }: UploadEvidenceProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(false);

  // Load existing evidence photos when component mounts
  useEffect(() => {
    if (caseItem?.id) {
      loadExistingPhotos();
    }
  }, [caseItem?.id]);

  const loadExistingPhotos = async () => {
    try {
      setLoading(true);
      const response = await apiService.getEvidencePhotos(caseItem!.id);
      console.log('[Evidence] Loaded existing photos:', response);
      setExistingPhotos(response.photos || []);
    } catch (error: any) {
      console.error('[Evidence] Failed to load existing photos:', error);
      // Don't show error alert, just show empty state
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to upload evidence.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,  // Extract EXIF data including GPS
    });

    if (!result.canceled) {
      const validPhotos: PhotoData[] = [];
      const rejectedPhotos: string[] = [];
      
      result.assets.forEach(asset => {
        // Try to extract GPS from EXIF data
        let lat: string | undefined = undefined;
        let long: string | undefined = undefined;
        
        if (asset.exif?.GPSLatitude !== undefined && asset.exif?.GPSLongitude !== undefined) {
          lat = asset.exif.GPSLatitude.toString();
          long = asset.exif.GPSLongitude.toString();
          console.log('[Evidence] Found GPS in EXIF:', { lat, long });
          
          validPhotos.push({
            uri: asset.uri,
            name: asset.fileName || `IMG_${Math.floor(Math.random() * 10000)}.jpg`,
            lat,
            long,
          });
        } else {
          const fileName = asset.fileName || `IMG_${Math.floor(Math.random() * 10000)}.jpg`;
          console.log('[Evidence] No GPS data in photo:', fileName);
          rejectedPhotos.push(fileName);
        }
      });
      
      // Only add photos with GPS
      if (validPhotos.length > 0) {
        setPhotos([...photos, ...validPhotos]);
      }
      
      // Show alert if some photos were rejected
      if (rejectedPhotos.length > 0) {
        Alert.alert(
          'GPS Required',
          `${rejectedPhotos.length} photo(s) rejected because they don't have GPS location data.\n\nOnly photos with geotag location can be uploaded as evidence.`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  const captureImage = async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your camera to capture photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images' as any,
      quality: 1,
      exif: true,  // Extract EXIF data including GPS
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      
      // Try to extract GPS from EXIF data from camera photo
      let lat: string | undefined = undefined;
      let long: string | undefined = undefined;
      
      if (asset.exif?.GPSLatitude !== undefined && asset.exif?.GPSLongitude !== undefined) {
        lat = asset.exif.GPSLatitude.toString();
        long = asset.exif.GPSLongitude.toString();
        console.log('[Evidence] Found GPS from camera photo:', { lat, long });
        
        const newPhoto: PhotoData = {
          uri: asset.uri,
          name: asset.fileName || `PHOTO_${Math.floor(Math.random() * 10000)}.jpg`,
          lat,
          long,
        };
        
        setPhotos([...photos, newPhoto]);
      } else {
        const fileName = asset.fileName || `PHOTO_${Math.floor(Math.random() * 10000)}.jpg`;
        console.log('[Evidence] Camera photo has no GPS data:', fileName);
        
        Alert.alert(
          'GPS Required',
          `Photo "${fileName}" rejected because it doesn't have GPS location data.\n\nPlease enable location services and try again. Only photos with geotag location can be uploaded as evidence.`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos(photos.filter(p => p.uri !== uri));
  };

  const deleteExistingPhoto = async (photoId: number) => {
    Alert.alert(
      'Delete Evidence Photo',
      'Are you sure you want to delete this photo? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Evidence] Deleting photo:', photoId);
              await apiService.deleteEvidencePhoto(photoId);
              
              // Remove from local state
              setExistingPhotos(existingPhotos.filter(p => p.id !== photoId));
              
              Alert.alert('Success', 'Photo deleted successfully');
            } catch (error: any) {
              console.error('[Evidence] Delete error:', error);
              Alert.alert('Error', error.message || 'Failed to delete photo');
            }
          },
        },
      ]
    );
  };

  const handleUpload = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'Please select at least one photo to upload.');
      return;
    }

    if (!caseItem?.id) {
      Alert.alert('Error', 'Case ID is missing. Please go back and try again.');
      return;
    }

    // Strict validation: All photos must have GPS data
    const photosWithoutGPS: string[] = [];
    
    photos.forEach((photo, index) => {
      if (!photo.lat || !photo.long) {
        photosWithoutGPS.push(`${index + 1}. ${photo.name}`);
      }
    });

    if (photosWithoutGPS.length > 0) {
      console.error('[Evidence] Photos missing GPS data:', { photosWithoutGPS });
      Alert.alert(
        'GPS Data Required',
        `Cannot upload. The following photos don't have GPS coordinates:\n${photosWithoutGPS.join('\n')}\n\nPlease remove these photos and select only geotagged images.`,
        [{ text: 'OK' }]
      );
      return;
    }

    performUpload();
  };

  const performUpload = async () => {
    setUploading(true);

    try {
      if (!caseItem?.id) {
        Alert.alert('Error', 'Case ID is missing');
        setUploading(false);
        return;
      }

      console.log('[Evidence] Starting upload', { 
        caseId: caseItem.id, 
        photoCount: photos.length 
      });

      // All photos must have GPS at this point (validated above)
      // Call API service for evidence upload
      const response = await apiService.uploadEvidence(
        caseItem!.id,
        photos
      );

      console.log('[Evidence] Upload successful', { response });

      if (response && response.uploaded_files > 0) {
        Alert.alert(
          'Success',
          `${response.uploaded_files} photo(s) uploaded successfully!`,
          [
            {
              text: 'OK',
              onPress: () => {
                setPhotos([]);
                loadExistingPhotos(); // Reload to show newly uploaded photos
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Upload Complete',
          'Evidence uploaded but no files were processed.',
          [{ text: 'OK', onPress: () => router.push('/incident') }]
        );
      }
    } catch (error: any) {
      console.error('[Evidence] Upload error:', {
        message: error.message,
        status: error.status,
        validationError: error.validationError,
        details: error.details,
      });

      // Get detailed error message, prioritizing validation errors
      let errorMessage = 'Failed to upload evidence';
      
      // First check for validation error from API service
      if (error.validationError) {
        errorMessage = error.validationError;
      } else if (error.details?.error) {
        errorMessage = error.details.error;
      } else if (error.details?.detail) {
        errorMessage = error.details.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Add status-specific context
      if (error.status === 400) {
        // Validation error from backend
        if (!errorMessage.startsWith('Validation')) {
          errorMessage = `Validation Error: ${errorMessage}`;
        }
      } else if (error.status === 401) {
        errorMessage = 'Your session has expired. Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to upload evidence.';
      } else if (error.status === 404) {
        errorMessage = 'Case not found. Please check the case ID and try again.';
      } else if (error.status === 0) {
        errorMessage = 'Cannot reach the server. Check your connection and try again.';
      }

      console.error('[Evidence] Showing error:', { status: error.status, errorMessage });
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitle}>Upload Evidence</Text>
          {caseItem && (
            <Text style={styles.headerSubtitle}>{caseItem.title}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Upload Geotagged Photos</Text>
        <Text style={styles.subtitle}>⚠️ GPS location is REQUIRED. Photos without geotag will be rejected.</Text>

        {/* Existing Uploaded Photos Section */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_BLUE} />
            <Text style={styles.loadingText}>Loading photos...</Text>
          </View>
        ) : existingPhotos.length > 0 && (
          <View style={styles.existingPhotosSection}>
            <Text style={styles.sectionTitle}>📸 Uploaded Evidence ({existingPhotos.length})</Text>
            <View style={styles.photoContainer}>
              {existingPhotos.map((item) => (
                <View key={item.id} style={styles.photoCard}>
                  <Image source={{ uri: item.photo_url }} style={styles.photoPreview} />
                  <TouchableOpacity 
                    style={styles.deleteBadge} 
                    onPress={() => deleteExistingPhoto(item.id)}
                  >
                    <Text style={styles.deleteIcon}>✕</Text>
                  </TouchableOpacity>
                  <View style={styles.photoInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{item.file_name}</Text>
                    <Text style={styles.coords}>{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Add New Photos Section */}
        <Text style={styles.sectionTitle}>➕ Add New Evidence</Text>

        {/* Add Photos Button & Take Photo Button */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
            <Text style={styles.buttonIcon}>📷</Text>
            <Text style={styles.buttonText}>Add Photos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cameraButton} onPress={captureImage}>
            <Text style={styles.buttonIcon}>📸</Text>
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <View style={styles.photoContainer}>
            {photos.map((item) => (
              <View key={item.uri} style={styles.photoCard}>
                <Image source={{ uri: item.uri }} style={styles.photoPreview} />
                <TouchableOpacity 
                  style={styles.removeBadge} 
                  onPress={() => removePhoto(item.uri)}
                >
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
                <View style={styles.photoInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.coords}>{item.lat}, {item.long}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Status Indicators */}
        {photos.length > 0 && (
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>✓</Text>
            <Text style={styles.statusText}>Photos Ready to Upload</Text>
          </View>
        )}

        {/* Conditional Alert Box */}
      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.uploadButton, (photos.length === 0 || uploading) && { opacity: 0.6 }]}
          disabled={photos.length === 0 || uploading}
          onPress={handleUpload}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.uploadButtonText}>Upload</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    backgroundColor: PRIMARY_BLUE,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  headerSubtitle: { color: '#E3F2FD', fontSize: 12, fontWeight: '400', marginTop: 4 },
  content: { padding: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  galleryButton: {
    width: '48%',
    height: 60,
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
    borderStyle: 'dashed',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    width: '48%',
    height: 60,
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
    borderStyle: 'dashed',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: { fontSize: 24, marginRight: 8 },
  buttonText: { color: PRIMARY_BLUE, fontSize: 16, fontWeight: '600' },
  photoContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  photoCard: {
    width: '48%',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 15,
    position: 'relative',
  },
  photoPreview: { height: 100, width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  removeBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusIcon: {
    color: '#4CAF50',
    fontSize: 20,
    fontWeight: 'bold',
  },
  photoInfo: { padding: 8 },
  fileName: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  coords: { fontSize: 10, color: '#757575' },
  statusRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 10 },
  statusText: { color: '#2E7D32', fontWeight: '600', marginLeft: 8 },
  alertBox: {
    width: '100%',
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center' },
  alertTitle: { color: '#C62828', fontWeight: 'bold', fontSize: 15 },
  alertSubtext: { color: '#E53935', fontSize: 13, marginTop: 4, marginLeft: 24 },
  footer: { padding: 20, backgroundColor: '#FFFFFF' },
  uploadButton: { backgroundColor: PRIMARY_BLUE, paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  uploadButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  loadingContainer: {
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  existingPhotosSection: {
    width: '100%',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  deleteBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,0,0,0.8)',
    borderRadius: 12,
    padding: 4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});