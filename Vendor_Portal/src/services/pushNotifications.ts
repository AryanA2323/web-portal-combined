import { Platform } from 'react-native';
import Constants from 'expo-constants';
import apiService from '@/services/api';

const getProjectId = () =>
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.expoConfig?.extra?.projectId;

const isExpoGo = () => Constants.appOwnership === 'expo';

const noopSubscription = { remove: () => {} };

const loadNotificationsModule = async () => {
  if (Platform.OS === 'web' || isExpoGo()) {
    return null;
  }

  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  return Notifications;
};

export const registerForPushNotifications = async () => {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Push notification registration skipped: no EAS projectId configured.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Assignments',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F5FA8',
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });

  const expoPushToken = tokenResponse.data;
  await apiService.registerVendorPushToken(
    expoPushToken,
    Platform.OS,
    Constants.deviceName || ''
  );

  return expoPushToken;
};

export const addNotificationResponseListener = (
  openCheck: (caseId: string, checkType: string) => void
) => {
  if (Platform.OS === 'web' || isExpoGo()) {
    return noopSubscription;
  }

  let subscription = noopSubscription;
  import('expo-notifications')
    .then((Notifications) => {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    const caseId = data.case_id ? String(data.case_id) : '';
    const checkType = data.check_type ? String(data.check_type) : '';

    if (caseId && checkType && data.notification_type === 'CHECK_ASSIGNED') {
      openCheck(caseId, checkType);
    }
      });
    })
    .catch((error) => {
      console.warn('Push notification listener unavailable:', error);
    });

  return {
    remove: () => subscription.remove(),
  };
};
