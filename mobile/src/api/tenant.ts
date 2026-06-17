import client from './client';
import { MyTenancyResponse } from '../types/tenant';

export const getMyTenancy = async (): Promise<MyTenancyResponse> => {
  const { data } = await client.get<MyTenancyResponse>('/tenants/my');
  return data;
};

export const addRoommate = async (tenantId: string, roommateData: { name: string, phone: string, idProof?: string }) => {
  const { data } = await client.post(`/tenants/${tenantId}/co-occupants`, { coOccupants: [roommateData] });
  return data;
};

export const updateRoommate = async (tenantId: string, coId: string, roommateData: { name: string, phone: string, idProof?: string }) => {
  const { data } = await client.patch(`/tenants/${tenantId}/co-occupants/${coId}`, roommateData);
  return data;
};

export const deleteRoommate = async (tenantId: string, coId: string) => {
  const { data } = await client.delete(`/tenants/${tenantId}/co-occupants/${coId}`);
  return data;
};
