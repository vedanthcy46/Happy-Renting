import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '../api/auth';
import { removePushToken } from '../api/notifications';
import { usePushStore } from './usePushStore';
import { clearBiometricCredentials } from '../hooks/useBiometric';
import { queryClient } from '../queryClient';
import { sqlitePersister } from '../persist/sqlitePersister';
import { clearOutbox } from '../db/outbox';
import { clearAllCaches } from '../db/cacheRepo';
import { clearSyncCursors, stopSyncEngine } from '../sync/syncEngine';
import type { UserRole, Workspace } from '../types/auth';

interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  ownerId?: string;
  mustChangePassword?: boolean;
  preferredLanguage?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  activeWorkspace: Workspace;
  // True when user has multiple workspaces and hasn't picked one yet this session
  needsWorkspacePicker: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  setWorkspace: (workspace: Workspace) => Promise<void>;
  dismissWorkspacePicker: () => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

/** Normalize roles — always returns a non-empty array. */
const normalizeRoles = (user: { role: UserRole; roles?: UserRole[] }): UserRole[] => {
  if (user.roles && user.roles.length > 0) return user.roles;
  return [user.role];
};

/** Derive the default workspace from a user's roles. */
const deriveWorkspace = (roles: UserRole[]): Workspace => {
  // superadmin alone is web-only; needs explicit 'owner' role for mobile owner workspace
  if (roles.includes('owner')) return 'owner';
  return 'tenant';
};

/** Whether the user has access to multiple workspaces on mobile. */
const isMultiRole = (roles: UserRole[]): boolean => {
  return roles.includes('owner') && roles.includes('tenant');
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  activeWorkspace: 'tenant',
  needsWorkspacePicker: false,

  setAuth: async (user, token) => {
    try {
      const roles = normalizeRoles(user);
      const userWithRoles = { ...user, roles };
      const current = useAuthStore.getState();
      // Only derive the workspace on a fresh login. Profile refreshes call
      // setAuth too (e.g. after fetching/updating the profile) and must NOT
      // clobber the workspace the user already picked (esp. multi-role users).
      const isFreshLogin = !current.user || !current.token;
      const workspace = isFreshLogin ? deriveWorkspace(roles) : current.activeWorkspace;
      const showPicker = isFreshLogin ? isMultiRole(roles) : current.needsWorkspacePicker;
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(userWithRoles));
      await SecureStore.setItemAsync('activeWorkspace', workspace);
      set({ user: userWithRoles, token, activeWorkspace: workspace, isLoading: false, needsWorkspacePicker: showPicker });
      if (__DEV__) console.log('[Auth] State updated — workspace:', workspace, 'multiRole:', showPicker, 'freshLogin:', isFreshLogin);
    } catch (error) {
      console.error('[Auth] Failed to save session', error);
    }
  },

  setWorkspace: async (workspace) => {
    try {
      await SecureStore.setItemAsync('activeWorkspace', workspace);
      set({ activeWorkspace: workspace, needsWorkspacePicker: false });
      if (__DEV__) console.log('[Auth] Workspace switched to:', workspace);
    } catch (error) {
      console.error('[Auth] Failed to persist workspace', error);
      set({ activeWorkspace: workspace, needsWorkspacePicker: false });
    }
  },

  dismissWorkspacePicker: () => set({ needsWorkspacePicker: false }),

  logout: async () => {
    // Best-effort: unregister the device push token so the logged-out user
    // stops receiving notifications. Uses the pre-logout auth token explicitly
    // since the client interceptor reads the store token.
    const pushToken = usePushStore.getState().token;
    const authToken = useAuthStore.getState().token;
    if (pushToken && authToken) {
      Promise.race([
        removePushToken(pushToken, authToken),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ]).catch(() => { });
    }

    try {
      stopSyncEngine();
      queryClient.clear();
      await Promise.all([
        SecureStore.deleteItemAsync('userToken'),
        SecureStore.deleteItemAsync('userData'),
        SecureStore.deleteItemAsync('activeWorkspace'),
        Promise.resolve(sqlitePersister.removeClient()).catch(() => { }),
        Promise.resolve(clearOutbox()).catch(() => { }),
        Promise.resolve(clearSyncCursors()).catch(() => { }),
        Promise.resolve(clearAllCaches()).catch(() => { }),
      ]);
      await clearBiometricCredentials();
      set({ user: null, token: null, activeWorkspace: 'tenant', isLoading: false, needsWorkspacePicker: false });
      if (__DEV__) console.log('[Auth] Logged out and storage cleared');
    } catch (error) {
      console.error('[Auth] Failed to clear session', error);
      queryClient.clear();
      await Promise.all([
        clearBiometricCredentials().catch(() => { }),
        Promise.resolve(sqlitePersister.removeClient()).catch(() => { }),
        Promise.resolve(clearOutbox()).catch(() => { }),
        Promise.resolve(clearSyncCursors()).catch(() => { }),
        Promise.resolve(clearAllCaches()).catch(() => { }),
      ]);
      set({ user: null, token: null, activeWorkspace: 'tenant', isLoading: false, needsWorkspacePicker: false });
    }
  },

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userDataStr = await SecureStore.getItemAsync('userData');
      const storedWorkspace = await SecureStore.getItemAsync('activeWorkspace');

      if (__DEV__) console.log('[Auth] Initializing...', { hasToken: !!token, hasUser: !!userDataStr });

      if (token && userDataStr) {
        try {
          const user: User = JSON.parse(userDataStr);
          const roles = normalizeRoles(user);
          const userWithRoles = { ...user, roles };
          const activeWorkspace: Workspace =
            (storedWorkspace as Workspace) ?? deriveWorkspace(roles);

          // Validate the stored token before restoring the session. A stale or
          // expired token would otherwise be restored, kick the sync engine, and
          // surface a confusing "session expired" alert on every launch. We do this
          // here (rather than trusting the SecureStore copy) so invalid sessions are
          // cleared silently.
          let valid = false;
          try {
            const res = await getMe(token);
            valid = !!res?.success;
          } catch (e: any) {
            // Network/offline errors are not auth failures — keep the stored session.
            valid = !(e?.response?.status === 401);
          }

          if (!valid) {
            await Promise.all([
              SecureStore.deleteItemAsync('userToken'),
              SecureStore.deleteItemAsync('userData'),
              SecureStore.deleteItemAsync('activeWorkspace'),
            ]);
            set({ token: null, user: null, activeWorkspace: 'tenant', isLoading: false, needsWorkspacePicker: false });
            if (__DEV__) console.log('[Auth] Stored session invalid/expired — cleared silently');
            return;
          }

          // Don't show picker on cold start — user already chose a workspace last session
          set({ token, user: userWithRoles, activeWorkspace, isLoading: false, needsWorkspacePicker: false });
        } catch (e) {
          console.error('[Auth] Failed to parse user data', e);
          await SecureStore.deleteItemAsync('userToken');
          await SecureStore.deleteItemAsync('userData');
          await SecureStore.deleteItemAsync('activeWorkspace');
          set({ token: null, user: null, activeWorkspace: 'tenant', isLoading: false, needsWorkspacePicker: false });
        }
      } else {
        set({ token: null, user: null, activeWorkspace: 'tenant', isLoading: false, needsWorkspacePicker: false });
      }
    } catch (error) {
      console.error('[Auth] Initialization failed', error);
      set({ isLoading: false });
    }
  },
}));
