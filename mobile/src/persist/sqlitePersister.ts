import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { kvGet, kvRemove, kvSet } from '../db/kv';

export const PERSIST_KEY = 'happy-renting:react-query-cache';

const WRITE_DEBOUNCE_MS = 500;

let pendingClient: PersistedClient | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

async function writeClient(client: PersistedClient) {
  await kvSet(PERSIST_KEY, JSON.stringify(client));
}

function scheduleWrite(client: PersistedClient) {
  pendingClient = client;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    const latest = pendingClient;
    pendingClient = null;
    if (latest) {
      writeClient(latest).catch((error) => {
        if (__DEV__) console.warn('[Cache] Failed to persist cache', error);
      });
    }
  }, WRITE_DEBOUNCE_MS);
}

export const sqlitePersister: Persister = {
  async persistClient(client: PersistedClient) {
    scheduleWrite(client);
  },
  async restoreClient() {
    try {
      const raw = await kvGet(PERSIST_KEY);
      return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
    } catch (error) {
      if (__DEV__) console.warn('[Cache] Failed to restore cache', error);
      return undefined;
    }
  },
  async removeClient() {
    pendingClient = null;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    try {
      await kvRemove(PERSIST_KEY);
    } catch (error) {
      if (__DEV__) console.warn('[Cache] Failed to remove cache', error);
    }
  },
};
