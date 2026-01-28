// Generate Form Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Header, Button, Input } from '../../components/common';
import { COLORS } from '../../utils/constants';
import { getDemoCaseById } from '../../utils/demoData';

const GenerateFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { caseId } = route.params as { caseId: number };
  
  const caseData = getDemoCaseById(caseId);

  const [clientName, setClientName] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    if (!clientName) {
      Alert.alert('Error', 'Please enter client name');
      return;
    }

    setGenerating(true);
    try {
      // Simulate PDF generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert('Success', 'Authorization form generated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate form. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Generate Form"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Authorization Form</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Enter Client's Name"
            placeholder="John Smith"
            value={clientName}
            onChangeText={setClientName}
          />

          <View style={styles.formPreview}>
            <Text style={styles.previewTitle}>AUTHORIZATION FORM</Text>
            <View style={styles.previewSection}>
              <Text style={styles.previewText}>{clientName || '[Client Name]'}</Text>
            </View>
            <View style={styles.previewDivider} />
            <Text style={styles.previewInfo}>
              This authorization form will include all case details, photos, and reports.
            </Text>
          </View>

          <Button
            title="📄 Generate PDF"
            onPress={handleGeneratePDF}
            variant="primary"
            loading={generating}
            style={styles.generateButton}
          />
        </View>
      </ScrollView>
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
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
  },
  form: {
    padding: 16,
  },
  formPreview: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  previewSection: {
    paddingVertical: 16,
  },
  previewText: {
    fontSize: 16,
    color: COLORS.dark,
    textAlign: 'center',
  },
  previewDivider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 16,
  },
  previewInfo: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  generateButton: {
    marginTop: 8,
  },
});

export default GenerateFormScreen;
