import client from './client';
import { AiChatRequest, AiChatResponse, AiEntitlementResponse, Workspace } from '../types/ai';

export const sendAiMessage = async (payload: AiChatRequest): Promise<AiChatResponse> => {
  const { data } = await client.post<AiChatResponse>('/ai/message', payload, {
    timeout: 30000,
  });
  return data;
};

export const getAiEntitlement = async (workspace: Workspace): Promise<AiEntitlementResponse> => {
  const { data } = await client.get<AiEntitlementResponse>('/ai/entitlement', {
    params: { workspace },
  });
  return data;
};
