import client from './client';
import { ComplaintsResponse, ComplaintDetailResponse } from '../types/complaint';

export const getComplaints = async (): Promise<ComplaintsResponse> => {
  const { data } = await client.get<ComplaintsResponse>('/complaints');
  return data;
};

export const createComplaint = async (complaintData: {
  title: string;
  description: string;
  priority: string;
}): Promise<ComplaintDetailResponse> => {
  const { data } = await client.post<ComplaintDetailResponse>('/complaints', complaintData);
  return data;
};
