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
    { key: 'date_of_accident', label: 'Date of Accident', type: 'date', icon: 'calendar-outline', placeholder: 'Select Date' },
    { key: 'time_of_accident', label: 'Time of Accident', type: 'time', icon: 'clock-outline', placeholder: 'Select Time' },
    { key: 'description_of_accident', label: 'Description of Accident', type: 'multiline', icon: 'text-box-outline', autoPopulateKey: 'statement', placeholder: 'Auto-populated from audio transcript or type manually' },
    { key: 'investigation_datetime', label: 'Date & Time of Investigation', type: 'datetime', icon: 'calendar-clock-outline', placeholder: 'Select Date & Time' },
  ],
};

const normalizeCheckType = (type: string): string => {
  if (!type) return 'claimant';
  const lower = type.toLowerCase().trim();
  if (lower.includes('claimant')) return 'claimant';
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
  const normType = normalizeCheckType(checkType);

  // Per user directive: only show Questionnaire for claimant check right now
  if (normType !== 'claimant') {
    return null;
  }

  const fields = CHECK_FIELDS['claimant'];
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
      // 1. Try to restore local draft first
      const draft = await getDraftQuestionnaire(caseId, checkType);
      const defaults: Record<string, string> = { ...(initialData || {}), ...(draft || {}) };

      fields.forEach((field) => {
        if (!defaults[field.key] || defaults[field.key].trim() === '') {
          if (field.autoPopulateKey === 'statement' && statementText) {
            defaults[field.key] = statementText;
          }
        }
      });

      // Auto-populate description_of_accident if blank but statementText exists
      if (statementText && (!defaults.description_of_accident || defaults.description_of_accident === '')) {
        defaults.description_of_accident = statementText;
      }

      if (isMounted) {
        setFormData(defaults);
        onChange(defaults);
      }
    };

    loadFormValues();

    return () => {
      isMounted = false;
    };
  }, [caseId, checkType, initialData, statementText]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
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
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionEyebrow}>VERIFICATION FORM</Text>
          <Text style={styles.sectionTitle}>Questionnaire</Text>
        </View>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={16} color={theme.colors.primary || '#0F5FA8'} />
          <Text style={styles.badgeText}>Claimant Details</Text>
        </View>
      </View>
      
      <Text style={styles.sectionSubtitle}>
        Fill out all required details below. Details are saved as draft locally and uploaded upon check submission.
      </Text>

      <View style={styles.formGrid}>
        {fields.map((field) => {
          const isFocused = focusedKey === field.key;
          const isAutoPopulated = field.autoPopulateKey === 'statement' && !!statementText;
          const isPickerField = field.type === 'date' || field.type === 'time' || field.type === 'datetime';

          return (
            <View key={field.key} style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{field.label}</Text>
                {isAutoPopulated && (
                  <View style={styles.autoTag}>
                    <MaterialCommunityIcons name="text-recognition" size={12} color="#0D9488" />
                    <Text style={styles.autoTagText}>Auto Transcript</Text>
                  </View>
                )}
                {isPickerField && (
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

              {isPickerField && Platform.OS === 'web' ? (
                <View
                  style={[
                    styles.inputWrapper,
                    isFocused && styles.inputWrapperFocused,
                    disabled && styles.disabledInputWrapper,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={field.icon as any}
                    size={20}
                    color={isFocused ? (theme.colors.primary || '#0F5FA8') : '#94A3B8'}
                  />
                  {field.type === 'date' && (
                    <input
                      type="date"
                      value={formData[field.key] ? formData[field.key].split('/').reverse().join('-') : ''}
                      onChange={(e) => {
                        const val = e.target.value; // YYYY-MM-DD
                        if (val) {
                          const parts = val.split('-');
                          handleChange(field.key, `${parts[2]}/${parts[1]}/${parts[0]}`);
                        } else {
                          handleChange(field.key, '');
                        }
                      }}
                      disabled={disabled}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#0F172A',
                        backgroundColor: 'transparent',
                        fontFamily: 'inherit',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    />
                  )}
                  {field.type === 'time' && (
                    <input
                      type="time"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      disabled={disabled}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#0F172A',
                        backgroundColor: 'transparent',
                        fontFamily: 'inherit',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    />
                  )}
                  {field.type === 'datetime' && (
                    <input
                      type="datetime-local"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      disabled={disabled}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#0F172A',
                        backgroundColor: 'transparent',
                        fontFamily: 'inherit',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    />
                  )}
                </View>
              ) : isPickerField ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenPicker(field)}
                  style={[
                    styles.inputWrapper,
                    disabled && styles.disabledInputWrapper,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={field.icon as any}
                    size={20}
                    color={theme.colors.primary || '#0F5FA8'}
                  />
                  <Text
                    style={[
                      styles.input,
                      !formData[field.key] && { color: '#94A3B8' },
                      disabled && styles.disabledInput,
                    ]}
                  >
                    {formData[field.key] || field.placeholder || `Select ${field.label}`}
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
                    disabled && styles.disabledInputWrapper,
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
                      disabled && styles.disabledInput,
                    ]}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    placeholderTextColor="#94A3B8"
                    value={formData[field.key] || ''}
                    onChangeText={(val) => handleChange(field.key, val)}
                    onFocus={() => setFocusedKey(field.key)}
                    onBlur={() => setFocusedKey(null)}
                    multiline={field.type === 'multiline'}
                    numberOfLines={field.type === 'multiline' ? 4 : 1}
                    editable={!disabled}
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
});
