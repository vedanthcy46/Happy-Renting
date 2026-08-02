import { Platform } from 'react-native';
import client from './client';
import { ComplaintsResponse, ComplaintDetailResponse, Complaint } from '../types/complaint';
import { enqueueOutbox } from '../db/outbox';
import { isOnline } from '../sync/networkStatus';
import { queryClient } from '../queryClient';
import { readFormField } from '../utils/formData';
import { persistImageForOutbox } from '../utils/outboxImages';

export interface ComplaintFormPayload {
  title: string;
  description: string;
  priority: string;
  category: string;
  imageUri?: string;
}

export const getComplaints = async (updatedAfter?: string): Promise<ComplaintsResponse> => {
  const { data } = await client.get<ComplaintsResponse>('/complaints', {
    params: updatedAfter ? { updatedAfter } : undefined,
  });
  return data;
};

export const getComplaintDetail = async (id: string): Promise<ComplaintDetailResponse> => {
  const { data } = await client.get<ComplaintDetailResponse>(`/complaints/${id}`);
  return data;
};

export const createComplaintFormData = (payload: ComplaintFormPayload): FormData => {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('priority', payload.priority);
  formData.append('category', payload.category);

  if (payload.imageUri) {
    const filename = payload.imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('image', {
      uri: Platform.OS === 'ios' ? payload.imageUri.replace('file://', '') : payload.imageUri,
      name: filename,
      type,
    } as any);
  }

  return formData;
};

export const createComplaintRequest = async (formData: FormData): Promise<ComplaintDetailResponse> => {
  const { data } = await client.post<ComplaintDetailResponse>('/complaints', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const createComplaint = async (formData: FormData): Promise<ComplaintDetailResponse> => {
  if (isOnline()) {
    return createComplaintRequest(formData);
  }

  const readField = (name: string): any => readFormField(formData, name);

  const title = String(readField('title') ?? '');
  const description = String(readField('description') ?? '');
  const priority = String(readField('priority') ?? 'medium');
  const category = String(readField('category') ?? 'other');
  const image = readField('image') as any;
  const imageUri = typeof image?.uri === 'string' ? image.uri : undefined;

  const tempId = `local-${Date.now()}`;
  const persistedImageUri = imageUri ? await persistImageForOutbox(imageUri, 'complaint.jpg') : undefined;

  await enqueueOutbox('complaint.create', tempId, {
    title,
    description,
    priority,
    category,
    imageUri: persistedImageUri,
  });

  const tempComplaint: Complaint = {
    _id: tempId,
    tenantId: null,
    propertyId: null,
    ownerId: null,
    title,
    description,
    status: 'pending',
    priority: priority as any,
    category,
    images: imageUri ? [imageUri] : [],
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  queryClient.setQueryData(['complaints'], (old: any) => {
    const base = old || { success: true, count: 0, complaints: [] };
    return {
      ...base,
      count: (base.count || 0) + 1,
      complaints: [tempComplaint, ...(base.complaints || [])],
    };
  });

  return { success: true, complaint: tempComplaint };
};

export const addComplaintComment = async (id: string, message: string): Promise<{ success: boolean, comments: any[] }> => {
  const { data } = await client.post(`/complaints/${id}/comments`, { message });
  return data;
};
