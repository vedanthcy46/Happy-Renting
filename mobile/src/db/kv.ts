import { getDb, isDbSupported } from './database';

const memoryStore = new Map<string, string>();

export async function kvGet(key: string): Promise<string | null> {
  if (!isDbSupported()) {
    return memoryStore.get(key) ?? null;
  }
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv_store WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (!isDbSupported()) {
    memoryStore.set(key, value);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
    key,
    value
  );
}

export async function kvRemove(key: string): Promise<void> {
  if (!isDbSupported()) {
    memoryStore.delete(key);
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM kv_store WHERE key = ?', key);
}
