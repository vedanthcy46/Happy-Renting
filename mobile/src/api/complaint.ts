import client from './client';
import { ComplaintsResponse, ComplaintDetailResponse } from '../types/complaint';

export const getComplaints = async (): Promise<ComplaintsResponse> => {
  const { data } = await client.get<ComplaintsResponse>('/complaints');
  return data;
};

export const getComplaintDetail = async (id: string): Promise<ComplaintDetailResponse> => {
  const { data } = await client.get<ComplaintDetailResponse>(`/complaints/${id}`);
  return data;
};

export const createComplaint = async (formData: FormData): Promise<ComplaintDetailResponse> => {
  const { data } = await client.post<ComplaintDetailResponse>('/complaints', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const addComplaintComment = async (id: string, message: string): Promise<{ success: boolean, comments: any[] }> => {
  const { data } = await client.post(`/complaints/${id}/comments`, { message });
  return data;
};
