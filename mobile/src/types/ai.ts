export type Workspace = 'tenant' | 'owner';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  message: string;
  workspace: Workspace;
  language?: string;
  history: AiChatMessage[];
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  workspace: Workspace;
  model: string;
  message?: string;
}

export interface AiEntitlement {
  plan: string;
  workspace: Workspace;
  ownerId: string | null;
  isTenant: boolean;
  controlledByOwner: boolean;
  tenantId: string | null;
  propertyId: string | null;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  isUnlimited: boolean;
  month: string;
}

export interface AiEntitlementResponse {
  success: boolean;
  entitlement: AiEntitlement;
}
