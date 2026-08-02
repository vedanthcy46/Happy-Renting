import { TABLES, getCacheRow, putCacheRow } from '../db/cacheRepo';
import { MyTenancyResponse } from '../types/tenant';

const TABLE = TABLES.tenantProfile;
const ROW_ID = 'my';

export async function readTenancyCache(): Promise<MyTenancyResponse | null> {
  const row = await getCacheRow(TABLE, ROW_ID);
  if (!row) return null;
  return row.data as MyTenancyResponse;
}

export async function writeTenancyCache(res: MyTenancyResponse): Promise<void> {
  const updatedAt =
    (res.tenant as any)?.updatedAt || (res.tenant as any)?.joinDate || new Date().toISOString();
  await putCacheRow(TABLE, { id: ROW_ID, data: res, updatedAt });
}

export async function mergeTenancyCache(res: MyTenancyResponse): Promise<boolean> {
  const local = await getCacheRow(TABLE, ROW_ID);
  const incomingAt = (res.tenant as any)?.updatedAt || (res.tenant as any)?.joinDate || new Date().toISOString();
  if (local && local.updatedAt > incomingAt) return false;
  await writeTenancyCache(res);
  return true;
}
