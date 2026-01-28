// Data Validation Screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Header, Button } from '../../components/common';
import { COLORS } from '../../utils/constants';
import type { IncidentReport, ValidationWarning } from '../../types';

const DataValidationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { report } = route.params as { report: IncidentReport };
  
  const [validating, setValidating] = useState(true);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    validateReport();
  }, []);

  const validateReport = async () => {
    try {
      // Simulate validation with demo data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Perform client-side validation
      const clientWarnings: ValidationWarning[] = [];

      // Check required fields
      if (report.observation && report.statement && report.date_time && report.location) {
        clientWarnings.push({
          type: 'success',
          message: 'All required fields completed',
        });
      }

      // Check date consistency
      const reportDate = new Date(report.date_time);
      const now = new Date();
      if (reportDate <= now) {
        clientWarnings.push({
          type: 'success',
          message: 'Date and time consistent',
        });
      } else {
        clientWarnings.push({
          type: 'warning',
          message: 'Date is in the future',
        });
      }

      // Mock location mismatch (for demo)
      clientWarnings.push({
        type: 'warning',
        message: 'Warning: Location mismatch detected!',
        field: 'location',
      });

      setWarnings(clientWarnings);
    } finally {
      setValidating(false);
    }
  };

  const handleReviewAndFix = () => {
    navigation.goBack();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await reportService.submitIncidentReport(report);
      Alert.alert('Success', 'Report submitted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Dashboard' as never),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Data Validation"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Please Review:</Text>
        </View>

        <View style={styles.validationList}>
          {warnings.map((warning, index) => (
            <View
              key={index}
              style={[
                styles.validationItem,
                warning.type === 'success' && styles.validationSuccess,
                warning.type === 'warning' && styles.validationWarning,
                warning.type === 'error' && styles.validationError,
              ]}
            >
              <Text style={styles.validationIcon}>
                {warning.type === 'success' ? '✓' : '⚠'}
              </Text>
              <Text
                style={[
                  styles.validationText,
                  warning.type === 'success' && styles.validationTextSuccess,
                  warning.type === 'warning' && styles.validationTextWarning,
                  warning.type === 'error' && styles.validationTextError,
                ]}
              >
                {warning.message}
              </Text>
            </View>
          ))}
        </View>

        {warnings.some(w => w.type === 'warning' || w.type === 'error') && (
          <View style={styles.detailsSection}>
            {warnings
              .filter(w => w.field === 'location')
              .map((warning, index) => (
                <View key={index} style={styles.detailCard}>
                  <Text style={styles.detailLabel}>▸ Reported Location:</Text>
                  <Text style={styles.detailValue}>{report.location}</Text>
                  <Text style={styles.detailLabel}>▸ GPS Location:</Text>
                  <Text style={styles.detailValue}>
                    Broadway & 7th Ave, New York, NY
                  </Text>
                </View>
              ))}
          </View>
        )}

        <View style={styles.actionsContainer}>
          {warnings.some(w => w.type === 'warning' || w.type === 'error') ? (
            <>
              <Button
                title="Review & Fix"
                onPress={handleReviewAndFix}
                variant="warning"
                style={styles.actionButton}
              />
              <Text style={styles.orText}>
                or submit anyway (not recommended)
              </Text>
            </>
          ) : (
            <Button
              title="Submit Report"
              onPress={handleSubmit}
              variant="success"
              loading={submitting}
              style={styles.actionButton}
            />
          )}
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
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
  },
  validationList: {
    padding: 16,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  validationSuccess: {
    backgroundColor: '#d4edda',
  },
  validationWarning: {
    backgroundColor: '#fff3cd',
  },
  validationError: {
    backgroundColor: '#f8d7da',
  },
  validationIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  validationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  validationTextSuccess: {
    color: '#155724',
  },
  validationTextWarning: {
    color: '#856404',
  },
  validationTextError: {
    color: '#721c24',
  },
  detailsSection: {
    padding: 16,
  },
  detailCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.dark,
    marginBottom: 12,
  },
  actionsContainer: {
    padding: 16,
  },
  actionButton: {
    marginBottom: 0,
  },
  orText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 12,
  },
});

export default DataValidationScreen;
