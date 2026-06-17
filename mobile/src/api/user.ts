import client from './client';
import { User } from '../types/auth';

export const getProfile = async (): Promise<{ success: boolean, user: User }> => {
  const { data } = await client.get('/users/profile');
  return data;
};

export const updateProfile = async (userData: Partial<User>): Promise<{ success: boolean, user: User }> => {
  const { data } = await client.patch('/users/profile', userData);
  return data;
};

export const changePassword = async (passwordData: any): Promise<{ success: boolean, message: string }> => {
  const { data } = await client.post('/auth/change-password', passwordData);
  return data;
};
