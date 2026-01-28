// Upload Photos Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Geolocation from 'react-native-geolocation-service';
import { Header, Button } from '../../components/common';
import { COLORS } from '../../utils/constants';
import { getDemoCaseById } from '../../utils/demoData';
import type { Photo } from '../../types';

const UploadPhotosScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { caseId } = route.params as { caseId: number };
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const caseData = getDemoCaseById(caseId);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const getGPSLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('GPS Error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  };

  const handleAddPhoto = async () => {
    Alert.alert(
      'Add Photos',
      'Choose photo source',
      [
        {
          text: 'Camera',
          onPress: () => takePhoto(),
        },
        {
          text: 'Gallery',
          onPress: () => pickFromGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const takePhoto = async () => {
    const location = await getGPSLocation();
    
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: false,
    });

    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const newPhoto: Photo = {
        uri: asset.uri!,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        latitude: location?.latitude,
        longitude: location?.longitude,
        timestamp: new Date().toISOString(),
      };
      setPhotos([...photos, newPhoto]);
    }
  };

  const pickFromGallery = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 10,
    });

    if (result.assets) {
      const newPhotos: Photo[] = result.assets.map(asset => ({
        uri: asset.uri!,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        timestamp: new Date().toISOString(),
      }));
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
  };

  const handleUpload = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'Please add at least one photo');
      return;
    }

    setUploading(true);
    try {
      // Simulate upload with demo data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      Alert.alert('Success', 'Photos uploaded successfully with GPS data', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Upload Photos"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Upload Geotagged Photos</Text>
          <Text style={styles.subtitle}>Ensure GPS data is included</Text>
        </View>

        <View style={styles.photosGrid}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoCard}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(index)}
              >
                <Text style={styles.removeIcon}>×</Text>
              </TouchableOpacity>
              {photo.latitude && photo.longitude && (
                <View style={styles.gpsTag}>
                  <Text style={styles.gpsText}>✓ GPS</Text>
                </View>
              )}
              <Text style={styles.photoName} numberOfLines={1}>
                {photo.fileName}
              </Text>
              {photo.latitude && photo.longitude && (
                <Text style={styles.coordinates}>
                  {photo.latitude.toFixed(4)}, {photo.longitude.toFixed(4)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {photos.some(p => !p.latitude || !p.longitude) && (
          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Some photos missing GPS data. Location may not be accurate.
            </Text>
          </View>
        )}

        {photos.length > 0 && (
          <View style={styles.verifiedBox}>
            <Text style={styles.verifiedIcon}>✓</Text>
            <Text style={styles.verifiedText}>
              {photos.filter(p => p.latitude && p.longitude).length} photo(s) with GPS data verified
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomContainer}>
        <Button
          title="📷 Add Photos"
          onPress={handleAddPhoto}
          variant="secondary"
          style={styles.addButton}
        />
        <Button
          title="Upload"
          onPress={handleUpload}
          variant="primary"
          loading={uploading}
          disabled={photos.length === 0}
          style={styles.uploadButton}
        />
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
  header: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  photoCard: {
    width: '47%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.danger,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  gpsTag: {
    position: 'absolute',
    top: 4,
    left: 12,
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  gpsText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  photoName: {
    fontSize: 12,
    color: COLORS.dark,
    marginBottom: 4,
  },
  coordinates: {
    fontSize: 10,
    color: COLORS.gray,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.warning,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.dark,
  },
  verifiedBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.success,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifiedIcon: {
    fontSize: 20,
    marginRight: 8,
    color: COLORS.white,
  },
  verifiedText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '500',
  },
  bottomContainer: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    gap: 12,
  },
  addButton: {
    marginBottom: 0,
  },
  uploadButton: {
    marginBottom: 0,
  },
});

export default UploadPhotosScreen;
