import api from './client';
import { enqueueOutbox } from '../db/outbox';
import { isOnline } from '../sync/networkStatus';

export interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  data: any;
  read: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationsResponse {
  success: boolean;
  count: number;
  total: number;
  unreadCount: number;
  notifications: Notification[];
}

export const getNotifications = async (page = 1, limit = 50, updatedAfter?: string): Promise<NotificationsResponse> => {
  const { data } = await api.get(
    `/v2/notifications?page=${page}&limit=${limit}${updatedAfter ? `&updatedAfter=${encodeURIComponent(updatedAfter)}` : ''}`
  );
  return data;
};

export const markAsReadRequest = async (id: string): Promise<void> => {
  await api.patch(`/v2/notifications/${id}/read`);
};

export const markAllAsReadRequest = async (): Promise<void> => {
  await api.patch('/v2/notifications/read-all');
};

export const deleteNotificationRequest = async (id: string): Promise<void> => {
  await api.delete(`/v2/notifications/${id}`);
};

export const clearAllNotificationsRequest = async (): Promise<void> => {
  await api.delete('/v2/notifications/clear-all');
};

export const markAsRead = async (id: string): Promise<void> => {
  if (isOnline()) {
    await markAsReadRequest(id);
    return;
  }
  await enqueueOutbox('notification.read', id, { id });
};

export const markAllAsRead = async (): Promise<void> => {
  if (isOnline()) {
    await markAllAsReadRequest();
    return;
  }
  await enqueueOutbox('notification.readAll', null, {});
};

export const deleteNotification = async (id: string): Promise<void> => {
  if (isOnline()) {
    await deleteNotificationRequest(id);
    return;
  }
  await enqueueOutbox('notification.delete', id, { id });
};

export const clearAllNotifications = async (): Promise<void> => {
  if (isOnline()) {
    await clearAllNotificationsRequest();
    return;
  }
  await enqueueOutbox('notification.clearAll', null, {});
};

export const updatePushToken = async (token: string, deviceName: string, platform: string): Promise<void> => {
  await api.patch('/users/profile/push-token', { token, deviceName, platform });
};

export const removePushToken = async (token: string, authToken?: string): Promise<void> => {
  await api.delete('/users/profile/push-token', {
    data: { token },
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
};

export const sendTestPush = async (): Promise<{ pushTokenCount: number; validPushTokenCount: number }> => {
  const { data } = await api.post('/v2/notifications/test-push');
  return data;
};
