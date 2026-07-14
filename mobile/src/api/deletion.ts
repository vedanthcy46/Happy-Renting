import client from './client';

export interface DeletionRequestPayload {
  reason?: string;
}

export interface DeletionStatusData {
  referenceId: string;
  status: 'pending_owner' | 'owner_approved' | 'owner_rejected' | 'cancelled' | 'completed';
  reason?: string;
  createdAt: string;
  ownerActionAt?: string;
  scheduledDeletionAt?: string;
  cancelledAt?: string;
  tenantStatus?: string;
  deletionRejectedReason?: string;
}

export interface DeletionResponse {
  success: boolean;
  data?: DeletionStatusData | { referenceId: string; message: string };
  message?: string;
}

export const requestDeletion = async (payload: DeletionRequestPayload): Promise<DeletionResponse> => {
  const { data } = await client.post<DeletionResponse>('/account/delete/request', payload);
  return data;
};

export const getMyDeletionStatus = async (): Promise<DeletionResponse> => {
  const { data } = await client.get<DeletionResponse>('/account/delete/my-status');
  return data;
};

export const cancelDeletion = async (): Promise<DeletionResponse> => {
  const { data } = await client.post<DeletionResponse>('/account/delete/cancel');
  return data;
};
