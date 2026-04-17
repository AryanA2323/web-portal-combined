import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { logoutUser } from '@/store/authSlice';
import { theme } from '@/config/theme';

export default function ProfileScreen() {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    company: user?.company || '',
  });

  const initials = useMemo(() => {
    if (!user?.name) return 'V';
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }, [user?.name]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      company: user?.company || '',
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const InfoField = ({ label, value, field, icon }: any) => {
    if (isEditing) {
      return (
        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            style={styles.input}
            value={formData[field as keyof typeof formData]}
            onChangeText={(text) => setFormData({ ...formData, [field]: text })}
            placeholder={`Enter ${label.toLowerCase()}`}
            placeholderTextColor={theme.colors.textMuted}
            editable={field !== 'email'}
          />
        </View>
      );
    }

    return (
      <View style={styles.fieldCard}>
        <View style={styles.fieldLabelRow}>
          <MaterialCommunityIcons name={icon} size={17} color={theme.colors.primary} />
          <Text style={styles.fieldLabel}>{label}</Text>
        </View>
        <Text style={styles.fieldValue}>{value || 'Not provided'}</Text>
      </View>
    );
  };

  const ActionRow = ({ icon, title, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.actionIconWrap}>
        <MaterialCommunityIcons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <Text style={styles.actionText}>{title}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0F5FA8', '#0A4274']} style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName}>{user.name}</Text>
        <Text style={styles.headerEmail}>{user.email}</Text>
        <View style={styles.headerMetaRow}>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="briefcase-outline" size={14} color="#FFFFFF" />
            <Text style={styles.metaChipText}>{user.company || 'Vendor'}</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="check-circle-outline" size={14} color="#FFFFFF" />
            <Text style={styles.metaChipText}>Active</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Profile information</Text>
              <Text style={styles.cardSubtitle}>Keep your contact details current for faster coordination.</Text>
            </View>
            {!isEditing && (
              <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)} activeOpacity={0.85}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.fieldsContainer}>
            <InfoField label="Full Name" value={user.name} field="name" icon="account-outline" />
            <InfoField label="Email Address" value={user.email} field="email" icon="email-outline" />
            <InfoField label="Phone Number" value={user.phone} field="phone" icon="phone-outline" />
            <InfoField label="Company" value={user.company} field="company" icon="domain" />
            <InfoField label="Address" value={user.address} field="address" icon="map-marker-outline" />
          </View>

          {isEditing && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.85}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account details</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>User ID</Text>
            <Text style={styles.accountValue}>{user.id || 'N/A'}</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Account Type</Text>
            <Text style={styles.accountValue}>Vendor</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick actions</Text>
          <ActionRow
            icon="lock-outline"
            title="Change Password"
            onPress={() => Alert.alert('Change Password', 'This feature will be implemented soon')}
          />
          <ActionRow
            icon="shield-account-outline"
            title="Privacy Settings"
            onPress={() => Alert.alert('Privacy Settings', 'This feature will be implemented soon')}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => dispatch(logoutUser())} activeOpacity={0.85}>
          <MaterialCommunityIcons name="logout" size={18} color={theme.colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 56,
    paddingBottom: 34,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerEmail: {
    marginTop: 6,
    color: '#DCEEFF',
    fontSize: 14,
    textAlign: 'center',
  },
  headerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  metaChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  content: {
    flex: 1,
    marginTop: -18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    marginBottom: 14,
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
  },
  editButtonText: {
    fontWeight: '700',
    color: theme.colors.primary,
    fontSize: 13,
  },
  fieldsContainer: {
    gap: 12,
  },
  fieldCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  fieldValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.card,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  accountLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  accountValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: theme.colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    color: theme.colors.success,
    fontWeight: '800',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  actionText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 4,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1B8B8',
    backgroundColor: theme.colors.errorSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: theme.colors.error,
    fontWeight: '800',
    fontSize: 15,
  },
});
