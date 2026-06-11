import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import apiService from '@/services/api';
import { theme } from '@/config/theme';
import { VendorNotification } from '@/types';

const checkTypeLabels: Record<string, string> = {
  claimant: 'Claimant Check',
  insured: 'Insured Check',
  driver: 'Driver Check',
  spot: 'Spot Check',
  chargesheet: 'Chargesheet',
  rti: 'RTI Check',
  rto: 'RTO Check',
};

const notificationMeta: Record<string, {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  background: string;
  title: string;
}> = {
  CHECK_ASSIGNED: {
    icon: 'clipboard-check-outline',
    color: theme.colors.success,
    background: theme.colors.successSoft,
    title: 'Check assigned',
  },
  CHECK_REMOVED: {
    icon: 'clipboard-remove-outline',
    color: theme.colors.warning,
    background: theme.colors.warningSoft,
    title: 'Check removed',
  },
};

const formatNotificationTime = (value: string) => {
  if (!value) return '';
  const normalizedValue = /[zZ]|[+-]\d{2}:\d{2}$/.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
};

const isNotAssignedError = (error: any) => {
  const message = String(error?.details?.error || error?.message || '').trim();
  return (
    error?.status === 403 ||
    error?.status === 404 ||
    /not assigned|removed|reassigned|access denied|permission/i.test(message)
  );
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadNotifications = useCallback(async (refreshing = false, silent = false) => {
    try {
      if (!silent) {
        setErrorMessage('');
        if (refreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
      }

      const response = await apiService.getVendorNotifications();
      setNotifications(response.notifications || []);
      setUnreadCount(response.unread_count || 0);
    } catch (error: any) {
      if (!silent) {
        setErrorMessage(error?.message || 'Unable to load notifications.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications(false, true);
    }, [loadNotifications])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        loadNotifications(false, true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadNotifications(false, true);
      }
    });

    return () => subscription.remove();
  }, [loadNotifications]);

  const handleNotificationPress = async (item: VendorNotification) => {
    if (!item.is_read) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id ? { ...notification, is_read: true } : notification
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      try {
        await apiService.markVendorNotificationRead(item.id);
      } catch {
        loadNotifications(true);
        return;
      }
    }

    if (item.notification_type === 'CHECK_REMOVED') {
      Alert.alert(
        'Check not assigned',
        item.message || 'This check is not assigned to you or has been removed from you.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (item.notification_type === 'CHECK_ASSIGNED') {
      try {
        await apiService.getVendorCheckDetail(item.case_id, item.check_type);
        router.push({
          pathname: '/case-details',
          params: { caseId: String(item.case_id), checkType: item.check_type },
        });
      } catch (error: any) {
        if (isNotAssignedError(error)) {
          Alert.alert(
            'Check not assigned',
            'This check is not currently assigned to you. It may have been removed or reassigned by the admin.',
            [{ text: 'OK' }]
          );
          loadNotifications(true);
          return;
        }

        Alert.alert(
          'Unable to open check',
          error?.message || 'Please try again in a moment.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const renderNotification = (item: VendorNotification) => {
    const meta = notificationMeta[item.notification_type] || {
      icon: 'bell-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
      color: theme.colors.primary,
      background: theme.colors.primarySoft,
      title: 'Notification',
    };
    const checkLabel = checkTypeLabels[item.check_type] || item.check_type;
    const claimNumber = item.claim_number || item.case_number || 'No claim number';
    const eventTime = formatNotificationTime(item.created_at);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.88}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.background }]}>
          <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
        </View>

        <View style={styles.notificationBody}>
          <View style={styles.notificationTopRow}>
            <Text style={styles.notificationTitle} numberOfLines={1}>{meta.title}</Text>
            {!!eventTime && <Text style={styles.timeText}>{eventTime}</Text>}
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage}>{item.message}</Text>
          <View style={styles.footerRow}>
            <Text style={styles.checkNameText} numberOfLines={1}>{checkLabel}</Text>
            <Text style={styles.claimNumberText} numberOfLines={1}>{claimNumber}</Text>
          </View>
        </View>

        {item.notification_type === 'CHECK_ASSIGNED' && (
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Vendor portal</Text>
          <Text style={styles.title}>Alerts</Text>
        </View>
        <View style={styles.unreadBadge}>
          <MaterialCommunityIcons name="bell-badge-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={theme.colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.stateTitle}>Loading alerts</Text>
            <Text style={styles.stateHint}>Checking for assignment updates.</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={42} color={theme.colors.error} />
            <Text style={styles.stateTitle}>Could not load alerts</Text>
            <Text style={styles.stateHint}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadNotifications()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={42} color={theme.colors.textMuted} />
            <Text style={styles.stateTitle}>No alerts yet</Text>
            <Text style={styles.stateHint}>New assignments and removals will appear here.</Text>
          </View>
        ) : (
          notifications.map(renderNotification)
        )}
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
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },
  kicker: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  unreadBadgeText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  unreadCard: {
    borderColor: '#B9D9F4',
    backgroundColor: '#FBFDFF',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
    minWidth: 0,
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  notificationTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  notificationMessage: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkNameText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  claimNumberText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 140,
    textAlign: 'right',
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    paddingHorizontal: 24,
    paddingVertical: 34,
    ...theme.shadows.card,
  },
  stateTitle: {
    marginTop: 14,
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateHint: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
