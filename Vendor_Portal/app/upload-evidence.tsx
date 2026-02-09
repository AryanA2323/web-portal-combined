import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import UploadEvidence from '@/screens/UploadEvidance';

export default function UploadEvidenceScreen() {
  const params = useLocalSearchParams();
  
  // Parse the case data from params
  const caseItem = params.case ? JSON.parse(params.case as string) : undefined;
  
  return <UploadEvidence caseItem={caseItem} />;
}
