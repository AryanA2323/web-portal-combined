import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/config/theme';
import { saveDraftQuestionnaire, getDraftQuestionnaire } from '@/utils/draftStorage';

interface QuestionnaireFormProps {
  caseId: number;
  checkType: string;
  initialData: any;
  statementText: string;
  caseInfo: any;
  checkInfo: any;
  onChange: (data: any) => void;
  disabled?: boolean;
}

export interface FieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'multiline' | 'date' | 'time' | 'datetime';
  icon?: string;
  autoPopulateKey?: 'statement';
}

const CHECK_FIELDS: Record<string, FieldConfig[]> = {
  claimant: [
    { key: 'relation', label: 'Relation with Deceased / Injured', icon: 'account-multiple-outline', placeholder: 'e.g. Spouse, Father, Self' },
    { key: 'claim_type', label: 'Type of Claim', icon: 'clipboard-text-outline', placeholder: 'e.g. Fatal, Injury, Property Damage' },
    { key: 'deceased_injury_name', label: 'Deceased / Injured Person Name', icon: 'account-details-outline' },
    { key: 'deceased_injury_income', label: 'Deceased / Injured Income', icon: 'currency-inr', placeholder: 'e.g. ₹ 25,000 / month' },
    { key: 'monthly_income', label: 'Monthly Income of Claimant', icon: 'cash-multiple', placeholder: 'e.g. ₹ 20,000 / month' },
    { key: 'hr_manager', label: 'Name & No. of Company HR / Manager', icon: 'card-account-phone-outline', placeholder: 'e.g. Rajesh Kumar - 9876543210' },
    { key: 'fir_date', label: 'FIR Date', type: 'date', icon: 'calendar-alert', placeholder: 'Select FIR Date' },
    { key: 'reason_if_delayed', label: 'Reason if Delayed', type: 'multiline', icon: 'text-box-search-outline', placeholder: 'State reason if FIR was delayed' },
    { key: 'date_of_accident', label: 'Date of Accident', type: 'date', icon: 'calendar-outline', placeholder: 'Select Date' },
    { key: 'time_of_accident', label: 'Time of Accident', type: 'time', icon: 'clock-outline', placeholder: 'Select Time' },
    { key: 'description_of_accident', label: 'Description of Accident', type: 'multiline', icon: 'text-box-outline', autoPopulateKey: 'statement', placeholder: 'Auto-populated from audio transcript or type manually' },
    { key: 'investigation_datetime', label: 'Date & Time of Investigation', type: 'datetime', icon: 'calendar-clock-outline', placeholder: 'Select Date & Time' },
  ],
  insured: [
    { key: 'insured_name', label: 'Insured Name', icon: 'account-outline' },
    { key: 'insured_address', label: 'Insured Address', icon: 'map-marker-outline', type: 'multiline' },
    { key: 'insured_contact', label: 'Contact Number', icon: 'phone-outline' },
    { key: 'vehicle_number', label: 'Vehicle Number', icon: 'car-outline' },
    { key: 'vehicle_type', label: 'Vehicle Type', icon: 'car-info', placeholder: 'e.g. Private or Transport' },
    { key: 'rc', label: 'RC Number', icon: 'card-account-details-outline' },
    { key: 'rc_expiry', label: 'RC Expiry Date', type: 'date', icon: 'calendar-clock' },
    { key: 'driver_name', label: 'Driver Name', icon: 'steering' },
    { key: 'driver_contact', label: 'Driver Contact', icon: 'phone-outline' },
    { key: 'dl', label: 'DL Number', icon: 'card-account-details-outline' },
    { key: 'dl_expiry', label: 'DL Expiry Date', type: 'date', icon: 'calendar-clock' },
    { key: 'insurance_holder_name', label: 'Insurance Holder Name', icon: 'shield-account-outline' },
    { key: 'policy_expiry_date', label: 'Policy Expiry Date', type: 'date', icon: 'calendar-clock' },
    { key: 'different_owner_reason', label: 'Reason if Owner Different', type: 'multiline', icon: 'text-box-search-outline' },
    { key: 'date_of_accident', label: 'Date of Accident', type: 'date', icon: 'calendar-outline', placeholder: 'Select Date' },
    { key: 'time_of_accident', label: 'Time of Accident', type: 'time', icon: 'clock-outline', placeholder: 'Select Time' },
    { key: 'description_of_accident', label: 'Description of Accident', type: 'multiline', icon: 'text-box-outline', autoPopulateKey: 'statement', placeholder: 'Auto-populated from audio transcript' },
    { key: 'investigation_datetime', label: 'Date & Time of Investigation', type: 'datetime', icon: 'calendar-clock-outline' },
  ],
  driver: [
    { key: 'driver_name', label: 'Driver Name', icon: 'steering' },
    { key: 'driver_address', label: 'Driver Address', icon: 'map-marker-outline', type: 'multiline' },
    { key: 'driver_contact', label: 'Contact Number', icon: 'phone-outline' },
    { key: 'driver_relation', label: 'Relation with Insured', icon: 'account-multiple-outline' },
    { key: 'insured_name', label: 'Insured Name', icon: 'account-outline' },
    { key: 'insured_contact', label: 'Insured Contact', icon: 'phone-outline' },
    { key: 'vehicle_number', label: 'Vehicle Number', icon: 'car-outline' },
    { key: 'vehicle_type', label: 'Vehicle Type', icon: 'car-info', placeholder: 'e.g. Private or Transport' },
    { key: 'dl', label: 'DL Number', icon: 'card-account-details-outline' },
    { key: 'dl_expiry', label: 'DL Expiry Date', type: 'date', icon: 'calendar-clock' },
    { key: 'insurance_holder_name', label: 'Insurance Holder Name', icon: 'shield-account-outline' },
    { key: 'different_owner_reason', label: 'Reason if other than Insured', type: 'multiline', icon: 'text-box-search-outline' },
    { key: 'date_of_accident', label: 'Date of Accident', type: 'date', icon: 'calendar-outline', placeholder: 'Select Date' },
    { key: 'time_of_accident', label: 'Time of Accident', type: 'time', icon: 'clock-outline', placeholder: 'Select Time' },
    { key: 'description_of_accident', label: 'Description of Accident', type: 'multiline', icon: 'text-box-outline', autoPopulateKey: 'statement', placeholder: 'Auto-populated from audio transcript' },
    { key: 'investigation_datetime', label: 'Date & Time of Investigation', type: 'datetime', icon: 'calendar-clock-outline' },
  ],
  insured_cum_driver: [
    { key: 'insured_name', label: 'Insured / Driver Name', icon: 'account-outline' },
    { key: 'insured_address', label: 'Insured / Driver Address', icon: 'map-marker-outline', type: 'multiline' },
    { key: 'insured_contact', label: 'Contact Number', icon: 'phone-outline' },
    { key: 'driver_relation', label: 'Relation with Insured', icon: 'account-multiple-outline', placeholder: 'e.g. Self' },
    { key: 'vehicle_number', label: 'Vehicle Number', icon: 'car-outline' },
    { key: 'vehicle_type', label: 'Vehicle Type', icon: 'car-info', placeholder: 'e.g. Private or Transport' },
    { key: 'rc', label: 'RC Number', icon: 'card-account-details-outline' },
    { key: 'rc_expiry', label: 'RC Expiry Date', type: 'date', icon: 'calendar-clock' },
    { key: 'dl', label: 'DL Number', icon: 'card-account-details-outline' },
    { key: 'dl_expiry', label: 'DL Expiry Date', type: 'date', icon: 'calendar-clock' },
    { key: 'insurance_holder_name', label: 'Insurance Holder Name', icon: 'shield-account-outline' },
    { key: 'policy_expiry_date', label: 'Policy Expiry Date', type: 'date', icon: 'calendar-clock' },
    { key: 'different_owner_reason', label: 'Reason if Owner Different', type: 'multiline', icon: 'text-box-search-outline' },
    { key: 'date_of_accident', label: 'Date of Accident', type: 'date', icon: 'calendar-outline', placeholder: 'Select Date' },
    { key: 'time_of_accident', label: 'Time of Accident', type: 'time', icon: 'clock-outline', placeholder: 'Select Time' },
    { key: 'description_of_accident', label: 'Description of Accident', type: 'multiline', icon: 'text-box-outline', autoPopulateKey: 'statement', placeholder: 'Auto-populated from audio transcript' },
    { key: 'investigation_datetime', label: 'Date & Time of Investigation', type: 'datetime', icon: 'calendar-clock-outline' },
  ],
};

const normalizeCheckType = (type: string): string => {
  if (!type) return 'claimant';
  const lower = type.toLowerCase().trim();
  if (lower.includes('claimant')) return 'claimant';
  if (lower.includes('insured cum driver')) return 'insured_cum_driver';
  if (lower.includes('insured')) return 'insured';
  if (lower.includes('driver')) return 'driver';
  if (lower.includes('spot')) return 'spot';
  if (lower.includes('chargesheet')) return 'chargesheet';
  if (lower.includes('rti')) return 'rti';
  if (lower.includes('rto')) return 'rto';
  return lower;
};

// Date/Time Helper Functions
const padZero = (num: number) => num.toString().padStart(2, '0');

const formatDateStr = (date: Date): string => {
  const dd = padZero(date.getDate());
  const mm = padZero(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatTimeStr = (date: Date): string => {
  let hours = date.getHours();
  const minutes = padZero(date.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${padZero(hours)}:${minutes} ${ampm}`;
};

const formatDateTimeStr = (date: Date): string => {
  return `${formatDateStr(date)} ${formatTimeStr(date)}`;
};

export const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  caseId,
  checkType,
  initialData,
  statementText,
  caseInfo,
  checkInfo,
  onChange,
  disabled = false,
}) => {
  let normType = normalizeCheckType(checkType);
  const [isSameAsDriverFlag, setIsSameAsDriverFlag] = useState<boolean>(() => {
    let parsedInitialData = initialData;
    if (typeof initialData === 'string') {
      try { parsedInitialData = JSON.parse(initialData); } catch (e) { parsedInitialData = {}; }
    }
    return Boolean(
      checkInfo?.insured_cum_driver ||
      checkInfo?.driver_and_insured_same ||
      parsedInitialData?.insured_cum_driver === 'true' ||
      parsedInitialData?.insured_cum_driver === true ||
      parsedInitialData?.driver_and_insured_same === 'true' ||
      parsedInitialData?.driver_and_insured_same === true
    );
  });

  if ((normType === 'insured' || normType === 'driver') && isSameAsDriverFlag) {
    normType = 'insured_cum_driver';
  }

  if (!['claimant', 'insured', 'driver', 'insured_cum_driver'].includes(normType)) {
    return null;
  }

  const fields = CHECK_FIELDS[normType] || [];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  // Native Picker State
  const [pickerState, setPickerState] = useState<{
    fieldKey: string;
    fieldType: 'date' | 'time' | 'datetime';
    mode: 'date' | 'time';
    step: 'date' | 'time';
    tempDate: Date;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFormValues = async () => {
      // 1. Parse initial data safely in case it is a JSON string from backend
      let parsedInitialData = initialData;
      if (typeof initialData === 'string') {
        try {
          parsedInitialData = JSON.parse(initialData);
        } catch (e) {
          console.warn('Failed to parse initialData', e);
          parsedInitialData = {};
        }
      }

      // 2. Try to restore local draft (skip drafts for completed checks)
      const draft = disabled ? null : await getDraftQuestionnaire(caseId, checkType);

      if (isMounted && draft && ('insured_cum_driver' in draft || 'driver_and_insured_same' in draft)) {
        const draftFlag = draft.insured_cum_driver === 'true' || draft.insured_cum_driver === true || draft.driver_and_insured_same === 'true' || draft.driver_and_insured_same === true;
        if (draftFlag !== isSameAsDriverFlag) {
          setIsSameAsDriverFlag(draftFlag);
          return; // State change will trigger re-render and re-execute this effect with correct normType
        }
      }

      // Merge checkInfo, parsedInitialData, and draft
      const defaults: Record<string, any> = {
        ...(checkInfo || {}),
        ...(parsedInitialData || {}),
        ...(draft || {}),
      };

      const finalFormData: Record<string, string> = {};

      fields.forEach((field) => {
        const dbVal = (parsedInitialData && parsedInitialData[field.key] != null)
          ? parsedInitialData[field.key]
          : (checkInfo && checkInfo[field.key] != null)
            ? checkInfo[field.key]
            : null;

        const draftVal = (!disabled && draft && draft[field.key] != null) ? draft[field.key] : null;

        // DB value takes precedence if non-empty, otherwise fallback to draft if non-empty
        let val = (dbVal != null && String(dbVal).trim() !== '')
          ? dbVal
          : (draftVal != null && String(draftVal).trim() !== '')
            ? draftVal
            : null;

        // Fallbacks for common checkInfo field aliases
        if (val == null || String(val).trim() === '') {
          if (field.key === 'monthly_income' && checkInfo?.claimant_income) {
            val = checkInfo.claimant_income;
          } else if (field.key === 'deceased_injury_income' && checkInfo?.claimant_income) {
            val = checkInfo.claimant_income;
          } else if (field.key === 'deceased_injury_name' && checkInfo?.claimant_name) {
            val = checkInfo.claimant_name;
          } else if (normType === 'insured_cum_driver') {
            // If they are the same person, fallback to driver equivalents if insured is missing
            if (field.key === 'insured_name' && checkInfo?.driver_name) val = checkInfo.driver_name;
            if (field.key === 'insured_address' && checkInfo?.driver_address) val = checkInfo.driver_address;
            if (field.key === 'insured_contact' && checkInfo?.driver_contact) val = checkInfo.driver_contact;
          }
        }

        let valStr = val != null ? String(val) : '';

        if (!valStr || valStr.trim() === '') {
          if (field.autoPopulateKey === 'statement' && statementText) {
            valStr = statementText;
          }
        }

        finalFormData[field.key] = valStr;
      });

      // Auto-populate description_of_accident if blank, or if it matches single statement / statementText
      if (statementText && (
        !finalFormData.description_of_accident ||
        finalFormData.description_of_accident.trim() === '' ||
        finalFormData.description_of_accident === checkInfo?.statement ||
        finalFormData.description_of_accident.startsWith('Statement 1:')
      )) {
        finalFormData.description_of_accident = statementText;
      }

      // Preserve the same as driver flag in the form data
      if (isSameAsDriverFlag) {
        finalFormData['insured_cum_driver'] = 'true';
        finalFormData['driver_and_insured_same'] = 'true';
      }

      // Restore negative_status (only if it matches one of the valid negative statuses)
      const validStatuses = ['Non co-operative', 'Non Traceable', 'Shifted'];
      const nsDbVal = checkInfo?.negative_status;
      const nsDraftVal = draft?.negative_status;
      
      let nsValToUse = '';
      if (nsDbVal && validStatuses.includes(String(nsDbVal).trim())) {
        nsValToUse = String(nsDbVal).trim();
      } else if (nsDraftVal && validStatuses.includes(String(nsDraftVal).trim())) {
        nsValToUse = String(nsDraftVal).trim();
      }
      finalFormData['negative_status'] = nsValToUse;

      if (isMounted) {
        setFormData(finalFormData);
        onChange(finalFormData);
      }
    };

    loadFormValues();

    return () => {
      isMounted = false;
    };
  }, [caseId, checkType, initialData, statementText, checkInfo, disabled, isSameAsDriverFlag]);

  const handleChange = (key: string, value: string) => {
    if (disabled) return;
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      
      if (normType === 'insured_cum_driver') {
        if (key === 'insured_name') updated.driver_name = value;
        if (key === 'insured_address') updated.driver_address = value;
        if (key === 'insured_contact') updated.driver_contact = value;
        if (key === 'driver_relation') {
          // just keep it
        }
      }
      
      onChange(updated);
      saveDraftQuestionnaire(caseId, checkType, updated);
      return updated;
    });
  };

  const handleOpenPicker = (field: FieldConfig) => {
    if (disabled) return;
    const initial = new Date();
    if (field.type === 'date') {
      setPickerState({ fieldKey: field.key, fieldType: 'date', mode: 'date', step: 'date', tempDate: initial });
    } else if (field.type === 'time') {
      setPickerState({ fieldKey: field.key, fieldType: 'time', mode: 'time', step: 'time', tempDate: initial });
    } else if (field.type === 'datetime') {
      setPickerState({ fieldKey: field.key, fieldType: 'datetime', mode: 'date', step: 'date', tempDate: initial });
    }
  };

  const handleNativePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setPickerState(null);
      return;
    }

    if (!selectedDate || !pickerState) {
      setPickerState(null);
      return;
    }

    const { fieldKey, fieldType, step, tempDate } = pickerState;

    if (fieldType === 'date') {
      handleChange(fieldKey, formatDateStr(selectedDate));
      setPickerState(null);
    } else if (fieldType === 'time') {
      handleChange(fieldKey, formatTimeStr(selectedDate));
      setPickerState(null);
    } else if (fieldType === 'datetime') {
      if (step === 'date') {
        const combined = new Date(selectedDate);
        setPickerState({
          fieldKey,
          fieldType: 'datetime',
          mode: 'time',
          step: 'time',
          tempDate: combined,
        });
      } else {
        const finalDate = new Date(tempDate);
        finalDate.setHours(selectedDate.getHours());
        finalDate.setMinutes(selectedDate.getMinutes());
        handleChange(fieldKey, formatDateTimeStr(finalDate));
        setPickerState(null);
      }
    }
  };

  return (
    <View>
      {(checkType.toLowerCase().includes('insured') || checkType.toLowerCase().includes('driver')) && (
        <View style={[styles.section, { padding: 16, marginBottom: 16, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'flex-start' }}
            onPress={() => {
              if (disabled) return;
              const nextVal = !isSameAsDriverFlag;
              setIsSameAsDriverFlag(nextVal);
              
              setFormData((prev) => {
                const updated: any = {
                  ...prev,
                  insured_cum_driver: nextVal ? 'true' : 'false',
                  driver_and_insured_same: nextVal ? 'true' : 'false'
                };
                if (nextVal) {
                  if (updated.insured_name && !updated.driver_name) updated.driver_name = updated.insured_name;
                  if (updated.insured_address && !updated.driver_address) updated.driver_address = updated.insured_address;
                  if (updated.insured_contact && !updated.driver_contact) updated.driver_contact = updated.insured_contact;
                }
                onChange(updated);
                saveDraftQuestionnaire(caseId, checkType, updated);
                return updated;
              });
            }}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isSameAsDriverFlag ? "checkbox-marked" : "checkbox-blank-outline"}
              size={24}
              color={isSameAsDriverFlag ? "#16A34A" : "#52525B"}
              style={{ marginTop: -2 }}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#166534', marginBottom: 4 }}>
                Insured Same as Driver
              </Text>
              <Text style={{ fontSize: 13, color: '#166534', lineHeight: 18 }}>
                Check this if the driver is the same as the insured. Both checks will be submitted simultaneously.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Negative Check Status Section */}
      <View style={[styles.section, { marginBottom: 16 }]}>
        <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Negative Check Status</Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {['Non co-operative', 'Non Traceable', 'Shifted'].map((status) => {
            const isSelected = formData.negative_status === status;
            return (
              <TouchableOpacity
                key={status}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? '#FEE2E2' : '#F1F5F9',
                  paddingHorizontal: 6,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isSelected ? '#EF4444' : '#E2E8F0',
                }}
                onPress={() => {
                  setFormData((prev: any) => {
                    const newStatus = prev.negative_status === status ? '' : status;
                    const updated = { ...prev, negative_status: newStatus };
                    onChange(updated);
                    saveDraftQuestionnaire(caseId, checkType, updated);
                    return updated;
                  });
                }}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={18}
                  color={isSelected ? "#EF4444" : "#64748B"}
                />
                <Text 
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ 
                    marginLeft: 4, 
                    fontSize: 12, 
                    fontWeight: isSelected ? '700' : '500', 
                    color: isSelected ? '#991B1B' : '#475569' 
                  }}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {['Non co-operative', 'Non Traceable', 'Shifted'].includes(formData.negative_status || '') && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.label, { marginBottom: 6 }]}>Vendor Feedback / Reason</Text>
            <View style={[styles.inputWrapper, { height: 'auto', minHeight: 90, alignItems: 'flex-start', paddingVertical: 10 }]}>
              <MaterialCommunityIcons name="comment-text-outline" size={20} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
              <TextInput
                style={[styles.input, { height: 'auto', minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Enter vendor feedback or reason for negative status..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={formData.vendor_feedback || ''}
                onChangeText={(val) => handleChange('vendor_feedback', val)}
                editable={!disabled}
              />
            </View>
          </View>
        )}
      </View>

      {!['Non co-operative', 'Non Traceable', 'Shifted'].includes(formData.negative_status || '') && (
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.sectionEyebrow}>VERIFICATION FORM</Text>
              <Text style={styles.sectionTitle}>Questionnaire</Text>
            </View>
            <View style={styles.badge}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={16} color={theme.colors.primary || '#0F5FA8'} />
              <Text style={styles.badgeText}>{normType === 'insured' ? 'Insured Details' : normType === 'driver' ? 'Driver Details' : normType === 'insured_cum_driver' ? 'Insured & Driver Details' : 'Claimant Details'}</Text>
            </View>
          </View>
          
          <Text style={styles.sectionSubtitle}>
            {disabled
              ? 'View saved questionnaire responses for this check.'
              : 'Fill out all required details below. Details are saved as draft locally and uploaded upon check submission.'}
          </Text>

          <View style={styles.formGrid}>
            {fields.map((field) => {
              const isPopulatedInDB = checkInfo && checkInfo[field.key] != null && String(checkInfo[field.key]).trim() !== '';
              if (isPopulatedInDB && !disabled) {
                return null;
              }

              const isFocused = focusedKey === field.key;
              const isAutoPopulated = field.autoPopulateKey === 'statement' && !!statementText;
              const isPickerField = field.type === 'date' || field.type === 'time' || field.type === 'datetime';
              const fieldValue = formData[field.key] || '';

              return (
                <View key={field.key} style={styles.fieldContainer}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>{field.label}</Text>
                    {isAutoPopulated && !disabled && (
                      <View style={styles.autoTag}>
                        <MaterialCommunityIcons name="text-recognition" size={12} color="#0D9488" />
                        <Text style={styles.autoTagText}>Auto Transcript</Text>
                      </View>
                    )}
                    {isPickerField && !disabled && (
                      <View style={[styles.autoTag, { backgroundColor: '#E0F2FE' }]}>
                        <MaterialCommunityIcons
                          name={field.type === 'time' ? 'clock-outline' : 'calendar-month-outline'}
                          size={12}
                          color="#0284C7"
                        />
                        <Text style={[styles.autoTagText, { color: '#0284C7' }]}>
                          {field.type === 'date' ? 'Calendar' : field.type === 'time' ? 'Clock' : 'Calendar & Clock'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {disabled ? (
                    <View style={[styles.inputWrapper, styles.disabledInputWrapper]}>
                      <MaterialCommunityIcons
                        name={(field.icon as any) || 'text'}
                        size={20}
                        color="#64748B"
                      />
                      <Text style={styles.readOnlyText}>
                        {fieldValue || 'N/A'}
                      </Text>
                    </View>
                  ) : Platform.OS === 'web' && isPickerField ? (
                    <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
                      <MaterialCommunityIcons
                        name={field.icon as any}
                        size={20}
                        color={isFocused ? (theme.colors.primary || '#0F5FA8') : '#94A3B8'}
                      />
                      {field.type === 'date' && (
                        <input
                          type="date"
                          value={fieldValue}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '15px',
                            fontWeight: '500',
                            color: '#0F172A',
                            backgroundColor: 'transparent',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                          }}
                        />
                      )}
                      {field.type === 'time' && (
                        <input
                          type="time"
                          value={fieldValue}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '15px',
                            fontWeight: '500',
                            color: '#0F172A',
                            backgroundColor: 'transparent',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                          }}
                        />
                      )}
                      {field.type === 'datetime' && (
                        <input
                          type="datetime-local"
                          value={fieldValue}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '15px',
                            fontWeight: '500',
                            color: '#0F172A',
                            backgroundColor: 'transparent',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                          }}
                        />
                      )}
                    </View>
                  ) : isPickerField ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenPicker(field)}
                      style={styles.inputWrapper}
                    >
                      <MaterialCommunityIcons
                        name={field.icon as any}
                        size={20}
                        color={theme.colors.primary || '#0F5FA8'}
                      />
                      <Text
                        style={[
                          styles.input,
                          !fieldValue && { color: '#94A3B8' },
                        ]}
                      >
                        {fieldValue || field.placeholder || `Select ${field.label}`}
                      </Text>
                      <MaterialCommunityIcons
                        name={field.type === 'time' ? 'clock-edit-outline' : 'calendar-edit'}
                        size={18}
                        color={theme.colors.primary || '#0F5FA8'}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={[
                        styles.inputWrapper,
                        field.type === 'multiline' && styles.multilineWrapper,
                        isFocused && styles.inputWrapperFocused,
                      ]}
                    >
                      {field.icon && (
                        <MaterialCommunityIcons
                          name={field.icon as any}
                          size={20}
                          color={isFocused ? (theme.colors.primary || '#0F5FA8') : '#94A3B8'}
                          style={field.type === 'multiline' ? { marginTop: 10 } : undefined}
                        />
                      )}
                      <TextInput
                        style={[
                          styles.input,
                          field.type === 'multiline' && styles.multilineInput,
                        ]}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        placeholderTextColor="#94A3B8"
                        value={fieldValue}
                        onChangeText={(val) => handleChange(field.key, val)}
                        onFocus={() => setFocusedKey(field.key)}
                        onBlur={() => setFocusedKey(null)}
                        multiline={field.type === 'multiline'}
                        numberOfLines={field.type === 'multiline' ? 4 : 1}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Render Native DateTimePicker when active */}
          {pickerState && Platform.OS !== 'web' && (
            <DateTimePicker
              value={pickerState.tempDate}
              mode={pickerState.mode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleNativePickerChange}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.divider || '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary || '#0F5FA8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text || '#0F172A',
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary || '#0F5FA8',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#64748B',
    marginBottom: 20,
    lineHeight: 20,
  },
  formGrid: {
    gap: 16,
  },
  fieldContainer: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  autoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  multilineWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.primary || '#0F5FA8',
    backgroundColor: '#FFFFFF',
  },
  disabledInputWrapper: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
    padding: 0,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    color: '#64748B',
  },
  readOnlyText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyReadOnlyText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    fontWeight: '400',
  },
});
