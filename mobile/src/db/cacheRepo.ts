import { getDb, isDbSupported, TABLES, TableName } from './database';
import { getPendingOutbox, getFailedOutbox } from './outbox';

// ─────────────────────────────────────────────────────────────────────────
// Sync metadata (per-collection last-sync timestamps + arbitrary values)
// ─────────────────────────────────────────────────────────────────────────

export async function getSyncMeta(collection: string): Promise<{ lastSyncAt: string | null; value: string | null }> {
  if (!isDbSupported()) return { lastSyncAt: null, value: null };
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ last_sync_at: string; value: string | null }>(
      'SELECT last_sync_at, value FROM sync_metadata WHERE collection = ?',
      collection
    );
    return { lastSyncAt: row?.last_sync_at ?? null, value: row?.value ?? null };
  } catch {
    return { lastSyncAt: null, value: null };
  }
}

export async function setSyncMeta(collection: string, lastSyncAt: string, value?: string | null): Promise<void> {
  if (!isDbSupported()) return;
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_metadata (collection, last_sync_at, value) VALUES (?, ?, ?)',
      collection,
      lastSyncAt,
      value ?? null
    );
  } catch (error) {
    if (__DEV__) console.warn('[Cache] Failed to write sync meta', collection, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Generic JSON-row helpers. Every row stores the full entity as JSON plus a
// serializable updated_at used for conflict resolution.
// ─────────────────────────────────────────────────────────────────────────

export interface CacheRow {
  id: string;
  data: unknown;
  updatedAt: string;
}

async function upsertRow(table: TableName, row: CacheRow, extra?: Record<string, string>): Promise<void> {
  if (!isDbSupported()) return;
  const db = await getDb();
  const columns = ['_id', 'data', 'updated_at'];
  const values: (string | number)[] = [row.id, JSON.stringify(row.data), row.updatedAt];
  if (extra) {
    for (const [col, val] of Object.entries(extra)) {
      columns.push(col);
      values.push(val);
    }
  }
  const placeholders = columns.map(() => '?').join(', ');
  const assignment = columns.map((col) => `${col} = excluded.${col}`).join(', ');
  await db.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(_id) DO UPDATE SET ${assignment}`,
    ...values
  );
}

export async function putCacheRow(table: TableName, row: CacheRow, extra?: Record<string, string>): Promise<void> {
  try {
    await upsertRow(table, row, extra);
  } catch (error) {
    if (__DEV__) console.warn('[Cache] upsert failed', table, error);
  }
}

export async function getCacheRow(table: TableName, id: string): Promise<CacheRow | null> {
  if (!isDbSupported()) return null;
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ _id: string; data: string; updated_at: string }>(
      `SELECT _id, data, updated_at FROM ${table} WHERE _id = ?`,
      id
    );
    if (!row) return null;
    return { id: row._id, data: JSON.parse(row.data), updatedAt: row.updated_at };
  } catch (error) {
    if (__DEV__) console.warn('[Cache] read failed', table, error);
    return null;
  }
}

export async function getAllCacheRows(table: TableName): Promise<CacheRow[]> {
  if (!isDbSupported()) return [];
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ _id: string; data: string; updated_at: string }>(
      `SELECT _id, data, updated_at FROM ${table}`
    );
    return rows.map((row) => ({ id: row._id, data: JSON.parse(row.data), updatedAt: row.updated_at }));
  } catch (error) {
    if (__DEV__) console.warn('[Cache] read all failed', table, error);
    return [];
  }
}

export async function getCacheRowsWhere(
  table: TableName,
  column: string,
  value: string
): Promise<CacheRow[]> {
  if (!isDbSupported()) return [];
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ _id: string; data: string; updated_at: string }>(
      `SELECT _id, data, updated_at FROM ${table} WHERE ${column} = ?`,
      value
    );
    return rows.map((row) => ({ id: row._id, data: JSON.parse(row.data), updatedAt: row.updated_at }));
  } catch (error) {
    if (__DEV__) console.warn('[Cache] read where failed', table, error);
    return [];
  }
}

export async function deleteCacheRow(table: TableName, id: string): Promise<void> {
  if (!isDbSupported()) return;
  try {
    const db = await getDb();
    await db.runAsync(`DELETE FROM ${table} WHERE _id = ?`, id);
  } catch (error) {
    if (__DEV__) console.warn('[Cache] delete failed', table, error);
  }
}

export async function clearTable(table: TableName): Promise<void> {
  if (!isDbSupported()) return;
  try {
    const db = await getDb();
    await db.runAsync(`DELETE FROM ${table}`);
  } catch (error) {
    if (__DEV__) console.warn('[Cache] clear failed', table, error);
  }
}

/** Clear every entity cache table + sync metadata. Used on logout. */
export async function clearAllCaches(): Promise<void> {
  await Promise.all([
    clearTable(TABLES.tenantProfile),
    clearTable(TABLES.userProfile),
    clearTable(TABLES.rentRecords),
    clearTable(TABLES.paymentTransactions),
    clearTable(TABLES.complaints),
    clearTable(TABLES.notifications),
    clearTable(TABLES.properties),
    clearTable(TABLES.rooms),
    clearTable(TABLES.ownerTenants),
    clearTable(TABLES.ownerRentRecords),
    clearTable(TABLES.ownerTransactions),
    clearTable(TABLES.ownerComplaints),
    clearTable(TABLES.ownerExpenses),
    clearTable(TABLES.paymentSummary),
    clearTable(TABLES.syncMetadata),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Conflict resolution — "latest updated_at wins", server wins for rows that
// have no pending local mutation. Rows referenced by a pending/failed outbox
// item are never overwritten by stale server data.
// ─────────────────────────────────────────────────────────────────────────

export async function hasPendingMutation(entityId: string | null | undefined): Promise<boolean> {
  if (!entityId) return false;
  const [pending, failed] = await Promise.all([getPendingOutbox(), getFailedOutbox()]);
  return pending.some((item) => item.entityId === entityId) || failed.some((item) => item.entityId === entityId);
}

/**
 * Merge a server row into the local cache.
 * Returns true if the row was written (server won), false if the local row was kept.
 */
export async function mergeCacheRow(
  table: TableName,
  row: CacheRow,
  extra?: Record<string, string>
): Promise<boolean> {
  if (!isDbSupported()) return true;
  const local = await getCacheRow(table, row.id);
  if (local) {
    // Local pending mutation wins (it will be re-uploaded by the outbox).
    if ((await hasPendingMutation(row.id)) && local.updatedAt > row.updatedAt) {
      return false;
    }
    // Latest updated_at wins.
    if (local.updatedAt > row.updatedAt) {
      return false;
    }
  }
  await putCacheRow(table, row, extra);
  return true;
}

/**
 * Prune locally-created rows ('local-*' ids) whose outbox operation has
 * already completed (no pending/failed item references them anymore).
 */
export async function pruneLocalRows(table: TableName): Promise<void> {
  if (!isDbSupported()) return;
  try {
    const rows = await getAllCacheRows(table);
    for (const row of rows) {
      if (!String(row.id).startsWith('local-')) continue;
      if (!(await hasPendingMutation(row.id))) {
        await deleteCacheRow(table, row.id);
      }
    }
  } catch (error) {
    if (__DEV__) console.warn('[Cache] prune local rows failed', table, error);
  }
}

export { TABLES };
