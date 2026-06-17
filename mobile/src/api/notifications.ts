import api from './client';

export interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  data: any;
  isRead: boolean;
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

export const updatePushToken = async (token: string, deviceId: string, platform: string): Promise<void> => {
  await api.patch('/users/profile/push-token', { token, deviceId, platform });
};
