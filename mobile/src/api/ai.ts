import client from './client';
import { AiChatRequest, AiChatResponse } from '../types/ai';

export const sendAiMessage = async (payload: AiChatRequest): Promise<AiChatResponse> => {
  const { data } = await client.post<AiChatResponse>('/ai/message', payload, {
    timeout: 30000,
  });
  return data;
};
