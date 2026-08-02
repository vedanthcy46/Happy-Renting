import api from './client';

export interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  data: any;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  count: number;
  total: number;
  unreadCount: number;
  notifications: Notification[];
}

export const getNotifications = async (page = 1, limit = 50): Promise<NotificationsResponse> => {
  const { data } = await api.get(`/v2/notifications?page=${page}&limit=${limit}`);
  return data;
};

export const markAsRead = async (id: string): Promise<void> => {
  await api.patch(`/v2/notifications/${id}/read`);
};

export const markAllAsRead = async (): Promise<void> => {
  await api.patch('/v2/notifications/read-all');
};

export const updatePushToken = async (token: string, deviceName: string, platform: string): Promise<void> => {
  await api.patch('/users/profile/push-token', { token, deviceName, platform });
};

export const deleteNotification = async (id: string): Promise<void> => {
  await api.delete(`/v2/notifications/${id}`);
};

export const clearAllNotifications = async (): Promise<void> => {
  await api.delete('/v2/notifications/clear-all');
};

export const sendTestPush = async (): Promise<void> => {
  await api.post('/v2/notifications/test-push');
};
