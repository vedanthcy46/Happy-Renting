import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { clearBiometricCredentials } from '../hooks/useBiometric';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  ownerId?: string;
  mustChangePassword?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (user, token) => {
    try {
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
      set({ user, token, isLoading: false });
      if (__DEV__) console.log('[Auth] State updated after login');
    } catch (error) {
      console.error('[Auth] Failed to save session', error);
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userData');
      await clearBiometricCredentials();
      set({ user: null, token: null, isLoading: false });
      if (__DEV__) console.log('[Auth] Logged out and storage cleared');
    } catch (error) {
      console.error('[Auth] Failed to clear session', error);
      // Still clear the state
      await clearBiometricCredentials().catch(() => {});
      set({ user: null, token: null, isLoading: false });
    }
  },

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userDataStr = await SecureStore.getItemAsync('userData');
      
      if (__DEV__) console.log('[Auth] Initializing...', { hasToken: !!token, hasUser: !!userDataStr });

      if (token && userDataStr) {
        try {
          const user = JSON.parse(userDataStr);
          set({ token, user, isLoading: false });
        } catch (e) {
          console.error('[Auth] Failed to parse user data', e);
          await SecureStore.deleteItemAsync('userToken');
          await SecureStore.deleteItemAsync('userData');
          set({ token: null, user: null, isLoading: false });
        }
      } else {
        set({ token: null, user: null, isLoading: false });
      }
    } catch (error) {
      console.error('[Auth] Initialization failed', error);
      set({ isLoading: false });
    }
  },
}));
