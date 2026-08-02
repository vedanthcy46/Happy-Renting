import { TABLES, getCacheRow, putCacheRow } from '../db/cacheRepo';
import { User } from '../types/auth';

const TABLE = TABLES.userProfile;
const ROW_ID = 'my';

export async function readProfileCache(): Promise<{ success: boolean; user: User } | null> {
  const row = await getCacheRow(TABLE, ROW_ID);
  if (!row) return null;
  return row.data as { success: boolean; user: User };
}

export async function writeProfileCache(res: { success: boolean; user: User }): Promise<void> {
  await putCacheRow(TABLE, {
    id: ROW_ID,
    data: res,
    updatedAt: (res.user as any)?.updatedAt || new Date().toISOString(),
  });
}

export async function mergeProfileCache(res: { success: boolean; user: User }): Promise<boolean> {
  const local = await getCacheRow(TABLE, ROW_ID);
  const incomingAt = (res.user as any)?.updatedAt || new Date().toISOString();
  if (local && local.updatedAt > incomingAt) return false;
  await writeProfileCache(res);
  return true;
}
