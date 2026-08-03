import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/config/theme';

interface DisclaimerSectionProps {
  checked: boolean;
  onCheck: (checked: boolean) => void;
}

export const DisclaimerSection: React.FC<DisclaimerSectionProps> = ({ checked, onCheck }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>⚠️ Disclaimer / अस्वीकरण / अस्वीकरण</Text>
      </View>
      
      <View style={styles.content}>
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
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.checkboxContainer} 
          onPress={() => onCheck(!checked)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name={checked ? "checkbox-marked" : "checkbox-blank-outline"} 
            size={24} 
            color={checked ? theme.colors.primary : "#666"} 
          />
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxText}>
              <Text style={styles.boldText}>I have read and understood the above disclaimer.</Text> / मैंने उपरोक्त अस्वीकरण पढ़ लिया है और समझ लिया है। / मी वरील अस्वीकरण वाचले आणि समजले आहे।
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginVertical: 16,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#f5f7fa',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  content: {
    padding: 16,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  boldText: {
    fontWeight: '700',
  },
  iconText: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
    backgroundColor: '#fdfdfd',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  checkboxText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
  }
});
