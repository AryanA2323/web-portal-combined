// Incident Report Form Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Header, Button, Input } from '../../components/common';
import { COLORS, ROUTES } from '../../utils/constants';
import { getDemoCaseById, DEMO_INCIDENT_REPORT } from '../../utils/demoData';
import type { IncidentReport } from '../../types';

const FillReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { caseId } = route.params as { caseId: number };
  
  const caseData = getDemoCaseById(caseId);

  const [observation, setObservation] = useState('');
  const [statement, setStatement] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [location, setLocation] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!observation || !statement || !location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const report: IncidentReport = {
      case_id: caseId,
      observation,
      statement,
      date_time: dateTime.toISOString(),
      location,
    };

    // Navigate to validation screen
    navigation.navigate(ROUTES.DATA_VALIDATION as never, { report } as never);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Incident Report"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Data Entry Form</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionLabel}>Observation</Text>
          <Input
            placeholder="Witnessed vehicle collision at 5th & Main."
            value={observation}
            onChangeText={setObservation}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Text style={styles.sectionLabel}>Statement</Text>
          <Input
            placeholder="Driver ran red light and collided with another car."
            value={statement}
            onChangeText={setStatement}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Text style={styles.sectionLabel}>Date & Time</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>
              {dateTime.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })} - {dateTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dateTime}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDateTime(selectedDate);
                }
              }}
            />
          )}

          <Text style={styles.sectionLabel}>Location</Text>
          <Input
            placeholder="5th Ave & Main St, New York, NY"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <View style={styles.submitContainer}>
          <Button
            title="Submit"
            onPress={handleSubmit}
            variant="primary"
            loading={submitting}
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
  formHeader: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray,
  },
  form: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 12,
    marginTop: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.dark,
  },
  calendarIcon: {
    fontSize: 20,
  },
  submitContainer: {
    padding: 16,
  },
});

export default FillReportScreen;
