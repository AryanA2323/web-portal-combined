import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '@/config/theme';

const DISCLAIMER_STORAGE_KEY = 'last_disclaimer_date';

export const DailyDisclaimerModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    checkDisclaimerStatus();
  }, []);

  const checkDisclaimerStatus = async () => {
    try {
      const lastAcknowledgeDate = await AsyncStorage.getItem(DISCLAIMER_STORAGE_KEY);
      const todayDate = new Date().toISOString().split('T')[0];
      
      if (lastAcknowledgeDate !== todayDate) {
        setVisible(true);
      }
    } catch (error) {
      console.error('Error checking disclaimer status:', error);
      setVisible(true); // Default to showing if error
    }
  };

  const handleUnderstand = async () => {
    if (!isChecked) return;
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem(DISCLAIMER_STORAGE_KEY, todayDate);
      setVisible(false);
    } catch (error) {
      console.error('Error saving disclaimer status:', error);
      setVisible(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}} // Disable closing via back button
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="alert-circle" size={28} color="white" />
            <Text style={styles.headerText}>⚠️ Important Disclaimer / महत्वपूर्ण अस्वीकरण</Text>
          </View>
          
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.textContainer}>
              <Text style={styles.text}>
                Our Field Executive (FE) visits are strictly for claim investigation. <Text style={styles.iconText}>🚫</Text> No payment is required—any demand for money is illegal and should be reported immediately.{'\n'}
                <Text style={styles.iconText}>📞</Text> If you encounter such a demand, <Text style={styles.boldText}>contact our hotline: 99872 68218</Text>
              </Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.text}>
                <Text style={styles.boldText}>अस्वीकरण:</Text> हमारी फील्ड एक्जीक्यूटिव (FE) जांच के लिए आते हैं। <Text style={styles.iconText}>🚫</Text> कोई भुगतान आवश्यक नहीं है—पैसे की मांग गैरकानूनी है!{'\n'}
                <Text style={styles.iconText}>📞</Text> ऐसी स्थिति में, तुरंत हमारी हॉटलाइन पर संपर्क करें: <Text style={styles.boldText}>99872 68218</Text>
              </Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.text}>
                <Text style={styles.boldText}>अस्वीकरण:</Text> आमचे फील्ड एक्झिक्युटिव्ह (FE) फक्त दाव्याच्या चौकशीसाठी येतात. <Text style={styles.iconText}>🚫</Text> कोणतेही पेमेंट देणे आवश्यक नाही—पैशांची मागणी बेकायदेशीर आहे.{'\n'}
                <Text style={styles.iconText}>📞</Text> अशा परिस्थितीत, कृपया आमच्या हॉटलाइनवर संपर्क साधा. <Text style={styles.boldText}>99872 68218</Text>
              </Text>
            </View>
          </ScrollView>
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.checkboxContainer} 
              onPress={() => setIsChecked(!isChecked)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons 
                name={isChecked ? "checkbox-marked" : "checkbox-blank-outline"} 
                size={24} 
                color={isChecked ? theme.colors.error : "#666"} 
              />
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxText}>
                  <Text style={styles.boldText}>I have read and understood the above disclaimer.</Text> / मैंने उपरोक्त अस्वीकरण पढ़ लिया है और समझ लिया है।
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, !isChecked && styles.buttonDisabled]} 
              onPress={handleUnderstand}
              disabled={!isChecked}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    backgroundColor: theme.colors.error || '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  scrollView: {
    flexShrink: 1,
  },
  contentContainer: {
    padding: 20,
  },
  textContainer: {
    paddingBottom: 10,
  },
  text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: 'bold',
  },
  iconText: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 15,
  },
  footer: {
    padding: 20,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkboxTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  checkboxText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  button: {
    backgroundColor: theme.colors.error || '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
