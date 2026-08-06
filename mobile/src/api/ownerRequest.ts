import client from './client';

export interface OwnerRequestPayload {
  name: string;
  email: string;
  phone: string;
  propertyName?: string;
  propertyLocation?: string;
  verifiedToken: string;
}

export const sendOwnerRequestOtp = async (email: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await client.post('/owner-requests/verify-email/send-otp', { email });
  return data;
};

export const verifyOwnerRequestOtp = async (email: string, otp: string): Promise<{ success: boolean; message: string; verifiedToken?: string }> => {
  const { data } = await client.post('/owner-requests/verify-email/verify-otp', { email, otp });
  return data;
};

export const submitOwnerRequest = async (payload: OwnerRequestPayload): Promise<{ success: boolean; message: string }> => {
  const { data } = await client.post('/owner-requests', payload);
  return data;
};
