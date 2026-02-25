import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CaseDetails from '@/screens/CaseDetails';

export default function CaseDetailsScreen() {
  const params = useLocalSearchParams();
  
  const caseId = params.caseId ? Number(params.caseId) : 0;
  const checkType = (params.checkType as string) || '';
  
  return <CaseDetails caseId={caseId} checkType={checkType} />;
}
