import { create } from 'zustand';

interface PushState {
  token: string;
  status: 'idle' | 'registered' | 'failed' | 'permission_denied' | 'no_device';
  error: string;
  environment: string;
  setToken: (token: string, environment: string) => void;
  setFailed: (error: string) => void;
  setPermissionDenied: () => void;
  setNoDevice: () => void;
}

export const usePushStore = create<PushState>((set) => ({
  token: '',
  status: 'idle',
  error: '',
  environment: '',
  setToken: (token, environment) => set({ token, status: 'registered', error: '', environment }),
  setFailed: (error) => set({ status: 'failed', error }),
  setPermissionDenied: () => set({ status: 'permission_denied' }),
  setNoDevice: () => set({ status: 'no_device' }),
}));
