import { getDb, isDbSupported } from './database';

export type OutboxKind =
  | 'notification.read'
  | 'notification.readAll'
  | 'notification.delete'
  | 'notification.clearAll'
  | 'complaint.create'
  | 'payment.create'
  | 'profile.update';

export interface OutboxItem {
  id: number;
  kind: OutboxKind;
  entityId: string | null;
  payload: Record<string, unknown>;
  status: 'pending' | 'uploading' | 'failed';
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

let memorySequence = 0;
const memoryOutbox = new Map<number, OutboxItem>();

export async function enqueueOutbox(
  kind: OutboxKind,
  entityId: string | null,
  payload: Record<string, unknown>
): Promise<OutboxItem> {
  const now = Date.now();
  if (!isDbSupported()) {
    memorySequence += 1;
    const item: OutboxItem = {
      id: memorySequence,
      kind,
      entityId,
      payload,
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    memoryOutbox.set(item.id, item);
    return item;
  }

  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO outbox (kind, entity_id, payload, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    kind,
    entityId,
    JSON.stringify(payload),
    'pending',
    0,
    now,
    now
  );
  return {
    id: result.lastInsertRowId,
    kind,
    entityId,
    payload,
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mapRow(row: any): OutboxItem {
  return {
    id: row.id,
    kind: row.kind,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload || '{}'),
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPendingOutbox(): Promise<OutboxItem[]> {
  if (!isDbSupported()) {
    return Array.from(memoryOutbox.values())
      .filter((item) => item.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC"
  );
  return rows.map(mapRow);
}

export async function getFailedOutbox(): Promise<OutboxItem[]> {
  if (!isDbSupported()) {
    return Array.from(memoryOutbox.values()).filter((item) => item.status === 'failed');
  }
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM outbox WHERE status = 'failed' ORDER BY created_at ASC"
  );
  return rows.map(mapRow);
}

export async function markOutboxUploading(id: number): Promise<void> {
  if (!isDbSupported()) {
    const item = memoryOutbox.get(id);
    if (item) {
      item.status = 'uploading';
      item.updatedAt = Date.now();
    }
    return;
  }
  const db = await getDb();
  await db.runAsync(
    "UPDATE outbox SET status = 'uploading', updated_at = ? WHERE id = ?",
    Date.now(),
    id
  );
}

export async function markOutboxDone(id: number): Promise<void> {
  if (!isDbSupported()) {
    memoryOutbox.delete(id);
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
}

export async function markOutboxFailed(id: number, error: string): Promise<void> {
  if (!isDbSupported()) {
    const item = memoryOutbox.get(id);
    if (item) {
      item.status = 'failed';
      item.attempts += 1;
      item.lastError = error;
      item.updatedAt = Date.now();
    }
    return;
  }
  const db = await getDb();
  const row = await db.getFirstAsync<{ attempts: number }>(
    'SELECT attempts FROM outbox WHERE id = ?',
    id
  );
  await db.runAsync(
    "UPDATE outbox SET status = 'failed', attempts = ?, last_error = ?, updated_at = ? WHERE id = ?",
    (row?.attempts ?? 0) + 1,
    error,
    Date.now(),
    id
  );
}

export async function requeueFailedOutbox(): Promise<void> {
  const failed = await getFailedOutbox();
  if (failed.length === 0) return;
  const db = await getDb();
  if (!isDbSupported()) {
    failed.forEach((item) => {
      const stored = memoryOutbox.get(item.id);
      if (stored) {
        stored.status = 'pending';
        stored.updatedAt = Date.now();
      }
    });
    return;
  }
  await db.runAsync(
    "UPDATE outbox SET status = 'pending', updated_at = ? WHERE status = 'failed'",
    Date.now()
  );
}

export async function clearOutbox(): Promise<void> {
  if (!isDbSupported()) {
    memoryOutbox.clear();
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox');
}
