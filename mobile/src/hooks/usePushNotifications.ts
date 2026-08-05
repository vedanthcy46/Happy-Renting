import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { updatePushToken } from '../api/notifications';
import { useAuthStore } from '../store/useAuthStore';
import { usePushStore } from '../store/usePushStore';
import type * as NotificationsType from 'expo-notifications';

let Notifications: typeof NotificationsType | null = null;
let requireError: string = '';
try {
  Notifications = require('expo-notifications');
} catch (error: any) {
  requireError = error?.message || String(error);
  if (__DEV__) console.log('expo-notifications not available in this environment', error);
}

const detectEnvironment = (): string => {
  if (Platform.OS === 'web') return 'web browser';
  if (Constants.appOwnership === 'expo') return 'Expo Go';
  if (!Device.isDevice) return 'emulator/simulator';
  return Platform.OS === 'ios' ? 'iOS native' : 'Android native';
};

if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    if (__DEV__) console.log('Push notifications not supported in this environment (e.g. Expo Go).');
  }
}

export function usePushNotifications(onNotificationTap?: (data: any) => void) {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<NotificationsType.Notification | false>(false);
  const authToken = useAuthStore((state) => state.token);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const onNotificationTapRef = useRef(onNotificationTap);

  useEffect(() => {
    onNotificationTapRef.current = onNotificationTap;
  }, [onNotificationTap]);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });

    if (Notifications) {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        setNotification(notification);
      });

      const handleResponse = (response: any) => {
        const data = response?.notification?.request?.content?.data || {};
        onNotificationTapRef.current?.(data);
      };

      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleResponse);
      Notifications.getLastNotificationResponseAsync?.().then((last: any) => {
        if (last) handleResponse(last);
      });
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!expoPushToken || !authToken) return;
    updatePushToken(expoPushToken, Device.osBuildId || Device.modelName || 'unknown', Platform.OS)
      .then(() => usePushStore.setState({ status: 'registered' }))
      .catch((err) => {
        console.error('Push token sync failed', err);
        usePushStore.setState({ status: 'failed', error: `Sync failed: ${err?.message || err}` });
      });
  }, [expoPushToken, authToken]);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  let token;
  if (!Notifications) {
    usePushStore.getState().setFailed(requireError || 'expo-notifications not available');
    usePushStore.setState({ environment: detectEnvironment() });
    return token;
  }

  const envLabel = detectEnvironment();

  try {
    if (Platform.OS === 'android') {
      // Default channel
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        showBadge: true,
      });
      // High-priority channel for payment/urgent alerts
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Rent & Payment Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#DC2626',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        showBadge: true,
      });
    }

    if (!Device.isDevice) {
      usePushStore.getState().setNoDevice();
      usePushStore.setState({ environment: `${envLabel} (emulator/simulator)` });
      if (__DEV__) console.log('Push notifications require a physical device');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      usePushStore.getState().setPermissionDenied();
      usePushStore.setState({ environment: envLabel });
      if (__DEV__) console.log('Push notification permission denied');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
      applicationId: Constants.expoConfig?.android?.package ?? Constants.expoConfig?.ios?.bundleIdentifier,
    })).data;

    if (__DEV__) console.log('[Push] Expo push token:', token);

    usePushStore.getState().setToken(token, envLabel);
  } catch (error: any) {
    usePushStore.getState().setFailed(`${error?.message || error}`);
    usePushStore.setState({ environment: envLabel });
    if (__DEV__) console.log('Push notification registration failed', error);
  }

  return token;
}
