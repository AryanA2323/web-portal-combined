import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import UploadEvidence from '@/screens/UploadEvidance';

export default function UploadEvidenceScreen() {
  const params = useLocalSearchParams();
  
  return <UploadEvidence />;
}
