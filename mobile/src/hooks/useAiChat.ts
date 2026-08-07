import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { sendAiMessage } from '../api/ai';
import { AiChatMessage, Workspace } from '../types/ai';

/**
 * In-memory conversation memory, kept separate per workspace so the tenant
 * conversation and owner conversation never bleed into each other.
 */
const sessionCache: Record<Workspace, AiChatMessage[]> = {
  tenant: [],
  owner: [],
};

const MAX_SESSION_MESSAGES = 20;

export function useAiChat() {
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace || 'tenant');
  const [messages, setMessages] = useState<AiChatMessage[]>(() => [...sessionCache[activeWorkspace]]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef(activeWorkspace);

  useEffect(() => {
    workspaceRef.current = activeWorkspace;
    setMessages([...sessionCache[activeWorkspace]]);
  }, [activeWorkspace]);

  const clearChat = useCallback(() => {
    const ws = workspaceRef.current;
    sessionCache[ws] = [];
    setMessages([]);
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const ws = workspaceRef.current;
    const userMsg: AiChatMessage = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setError(null);
    setIsLoading(true);

    try {
      const history = sessionCache[ws].slice(-MAX_SESSION_MESSAGES);
      const res = await sendAiMessage({ message: trimmed, workspace: ws, history });
      if (!res.success) {
        throw new Error(res.message || 'Could not reach the assistant.');
      }
      const reply: AiChatMessage = { role: 'assistant', content: res.reply };
      const withReply = [...next, reply];
      sessionCache[ws] = withReply.slice(-MAX_SESSION_MESSAGES);
      setMessages(withReply);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Something went wrong. Please try again.');
      setMessages(next);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  return { messages, isLoading, error, send, clearChat, workspace: activeWorkspace };
}
