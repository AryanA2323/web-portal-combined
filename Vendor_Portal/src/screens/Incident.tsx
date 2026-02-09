import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  ScrollView, 
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { theme } from '@/config/theme';

const PRIMARY_BLUE = theme.colors.primary;

const IncidentForm = () => {
  const router = useRouter();
  // --- 1. STATE MANAGEMENT ---
  const [observation, setObservation] = useState('');
  const [statement, setStatement] = useState('');
  const [location, setLocation] = useState('5th Ave & Main St, New York, NY');
  const [date, setDate] = useState(new Date(2021, 6, 25, 15, 45)); // Default matching your UI image
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | 'datetime'>('date');
  const [loading, setLoading] = useState(false);

  // --- 2. HANDLERS ---
  
  // Handle Date Changes (cross-platform)
  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Android: show separate date then time pickers
    if (Platform.OS === 'android') {
      // If user dismissed picker (selectedDate undefined), close picker or stop chain
      if (!selectedDate) {
        setShowPicker(false);
        return;
      }

      if (pickerMode === 'date') {
        // Preserve existing time, update date portion
        const updated = new Date(date);
        updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        setDate(updated);
        // Now open time picker
        setPickerMode('time');
        setShowPicker(true);
        return;
      }

      if (pickerMode === 'time') {
        // Update time portion and close picker
        const updated = new Date(date);
        updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), selectedDate.getSeconds(), selectedDate.getMilliseconds());
        setDate(updated);
        setShowPicker(false);
        return;
      }

      // Fallback: close picker
      setShowPicker(false);
      return;
    }

    // iOS: single datetime picker
    if (selectedDate) setDate(selectedDate);
  };

  // Format Date for UI Display
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'long', day: 'numeric', year: 'numeric', 
      hour: 'numeric', minute: '2-digit', hour12: true 
    };
    return date.toLocaleString('en-US', options).replace(' at', ' -');
  };

  // Submit Data to API
  const handleSubmit = async () => {
    if (!observation || !statement) {
      Alert.alert("Missing Info", "Please fill in the observation and statement.");
      return;
    }

    setLoading(true);
    
    const payload = {
      observation,
      statement,
      dateTime: date.toISOString(),
      location,
    };

    try {
      const response = await fetch('https://your-api-endpoint.com/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert('Success', 'Report submitted successfully!');
      } else {
        Alert.alert('Error', 'Server rejected the report.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Check your internet connection or API URL.');
    } finally {
      setLoading(false);
    }
  };

  // --- 3. UI RENDERING ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BLUE} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incident Report</Text>
      </View>

      <ScrollView contentContainerStyle={styles.formContainer}>
        <Text style={styles.formTitle}>Data Entry Form</Text>

        {/* Observation Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Observation</Text>
          <TextInput
            style={styles.input}
            placeholder="Witnessed vehicle collision..."
            value={observation}
            onChangeText={setObservation}
            placeholderTextColor="#999"
          />
        </View>

        {/* Statement Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Statement</Text>
          <TextInput
            style={styles.input}
            placeholder="Driver ran red light..."
            value={statement}
            onChangeText={setStatement}
            placeholderTextColor="#999"
          />
        </View>

        {/* Date & Time Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date & Time</Text>
          <TouchableOpacity 
            style={styles.datePickerContainer} 
            onPress={() => {
              if (Platform.OS === 'android') {
                setPickerMode('date');
                setShowPicker(true);
              } else {
                setPickerMode('datetime');
                setShowPicker(true);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>
          
          {showPicker && (
            <DateTimePicker
              value={date}
              mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          )}
        </View>

        {/* Location Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter location"
            value={location}
            onChangeText={setLocation}
            placeholderTextColor="#999"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitButton, loading && { opacity: 0.7 }]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- 4. STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: PRIMARY_BLUE,
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 60,
    padding: 8,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  formContainer: {
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#555',
    marginVertical: 20,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 8,
    padding: 15,
    backgroundColor: '#FAFAFA',
  },
  dateText: {
    fontSize: 16,
    color: '#555',
    flex: 1,
  },
  calendarIcon: {
    fontSize: 20,
  },
  submitButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export { IncidentForm };
export default IncidentForm;