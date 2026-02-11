import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CaseDetails from '@/screens/CaseDetails';

export default function CaseDetailsScreen() {
  const params = useLocalSearchParams();
  
  // Parse the case data from params
  const caseItem = params.case ? JSON.parse(params.case as string) : undefined;
  
  return <CaseDetails caseItem={caseItem} />;
}
