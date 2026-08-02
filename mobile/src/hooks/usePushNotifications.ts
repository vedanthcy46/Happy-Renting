import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { updatePushToken } from '../api/notifications';
import { useAuthStore } from '../store/useAuthStore';
import type * as NotificationsType from 'expo-notifications';

let Notifications: typeof NotificationsType | null = null;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  if (__DEV__) console.log('expo-notifications not available in this environment');
}

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
    updatePushToken(expoPushToken, Device.osBuildId || Device.modelName || 'unknown', Platform.OS).catch(console.error);
  }, [expoPushToken, authToken]);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  let token;
  if (!Notifications) return token;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        if (__DEV__) console.log('Push notification permission denied');
        return;
      }
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })).data;
    } else {
      if (__DEV__) console.log('Push notifications require a physical device');
    }
  } catch (error) {
    if (__DEV__) console.log('Push notification registration failed', error);
  }

  return token;
}
