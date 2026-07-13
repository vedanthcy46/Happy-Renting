import client from './client';
import { LoginResponse } from '../types/auth';

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const { data } = await client.post<LoginResponse>('/auth/login', {
    email,
    password,
  });
  return data;
};

export const getMe = async (): Promise<{ success: boolean; user: any }> => {
  const { data } = await client.get('/auth/me');
  return data;
};

export const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await client.post('/auth/forgot-password', { email });
  return data;
};


