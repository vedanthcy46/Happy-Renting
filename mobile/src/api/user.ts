import client from './client';
import { User } from '../types/auth';
import { enqueueOutbox } from '../db/outbox';
import { isOnline } from '../sync/networkStatus';
import { readProfileCache, writeProfileCache } from '../repositories/profileRepository';

export interface ProfileResponse {
  success: boolean;
  user: User;
  queued?: boolean;
}

export const getProfile = async (): Promise<ProfileResponse> => {
  try {
    const { data } = await client.get<ProfileResponse>('/users/profile');
    await writeProfileCache(data);
    return data;
  } catch (error: any) {
    // Offline: fall back to the locally cached profile.
    if (!isOnline()) {
      const cached = await readProfileCache();
      if (cached) return cached;
    }
    throw error;
  }
};

export const updateProfileRequest = async (userData: Partial<User>): Promise<ProfileResponse> => {
  const { data } = await client.patch<ProfileResponse>('/users/profile', userData);
  return data;
};

export const updateProfile = async (userData: Partial<User>): Promise<ProfileResponse> => {
  if (isOnline()) {
    const data = await updateProfileRequest(userData);
    await writeProfileCache(data);
    return data;
  }

  // Offline: queue the update and apply it optimistically to the local profile.
  const tempId = `local-profile-${Date.now()}`;
  await enqueueOutbox('profile.update', tempId, userData);

  const cached = await readProfileCache();
  const mergedUser: User = { ...(cached?.user ?? ({} as User)), ...userData };
  const optimistic: ProfileResponse = { success: true, user: mergedUser, queued: true };
  await writeProfileCache(optimistic);
  return optimistic;
};

export const changePassword = async (passwordData: any): Promise<{ success: boolean, message: string }> => {
  const { data } = await client.post('/auth/change-password', passwordData);
  return data;
};

/** Sync the user's preferred language to the backend (best effort). */
export const setPreferredLanguage = async (language: string): Promise<boolean> => {
  try {
    const { data } = await client.patch<{ success: boolean }>('/users/profile/language', { language });
    return !!data?.success;
  } catch {
    return false;
  }
};

export interface EmailChangeResponse {
  success: boolean;
  message?: string;
  user?: User;
}

/** Step 1 of email change: send a 6-digit OTP to the new email address. */
export const requestEmailChange = async (email: string): Promise<{ success: boolean; message?: string }> => {
  const { data } = await client.post('/users/profile/change-email/request', { email });
  return data;
};

/** Step 2 of email change: verify the OTP and apply the change. */
export const verifyEmailChange = async (email: string, otp: string): Promise<EmailChangeResponse> => {
  const { data } = await client.post<EmailChangeResponse>('/users/profile/change-email/verify', { email, otp });
  return data;
};

/** Resend the email-change OTP to the pending new email address. */
export const resendEmailChangeOtp = async (email: string): Promise<{ success: boolean; message?: string }> => {
  const { data } = await client.post('/users/profile/change-email/resend', { email });
  return data;
};
