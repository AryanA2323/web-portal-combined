import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CaseDetails from '@/screens/CaseDetails';

export default function UploadEvidence() {
  const params = useLocalSearchParams();

  const caseId = params.caseId ? Number(params.caseId) : 0;
  const checkType = (params.checkType as string) || '';

  // Reuse CaseDetails which now includes upload functionality
  return <CaseDetails caseId={caseId} checkType={checkType} />;
}
