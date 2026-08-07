export type Workspace = 'tenant' | 'owner';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  message: string;
  workspace: Workspace;
  history: AiChatMessage[];
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  workspace: Workspace;
  model: string;
  message?: string;
}
