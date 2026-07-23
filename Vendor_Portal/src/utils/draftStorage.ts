import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const saveDraftQuestionnaire = async (caseId: number, checkType: string, data: any) => {
  if (!caseId || !checkType) return;
  const key = `draft_questionnaire_${caseId}_${checkType}`;
  const jsonStr = JSON.stringify(data || {});
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, jsonStr);
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  } else {
    try {
      await AsyncStorage.setItem(key, jsonStr);
    } catch (e) {
      console.warn('AsyncStorage save failed:', e);
    }
  }
};

export const getDraftQuestionnaire = async (caseId: number, checkType: string): Promise<any | null> => {
  if (!caseId || !checkType) return null;
  const key = `draft_questionnaire_${caseId}_${checkType}`;
  if (Platform.OS === 'web') {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  } else {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  }
};

export const clearDraftQuestionnaire = async (caseId: number, checkType: string) => {
  if (!caseId || !checkType) return;
  const key = `draft_questionnaire_${caseId}_${checkType}`;
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  } else {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {}
  }
};
