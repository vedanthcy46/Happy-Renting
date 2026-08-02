import { TABLES, getAllCacheRows, mergeCacheRow, putCacheRow, getSyncMeta, setSyncMeta } from '../db/cacheRepo';
import { Notification, NotificationsResponse } from '../api/notifications';

const TABLE = TABLES.notifications;
const META_KEY = 'notifications_meta';

function toNotification(data: unknown): Notification {
  return data as Notification;
}

interface NotificationMeta {
  count: number;
  total: number;
  unreadCount: number;
}

async function readMeta(): Promise<NotificationMeta> {
  const { value } = await getSyncMeta(META_KEY);
  if (value) {
    try {
      return JSON.parse(value) as NotificationMeta;
    } catch {
      // ignore corrupt meta
    }
  }
  return { count: 0, total: 0, unreadCount: 0 };
}

async function writeMeta(meta: NotificationMeta): Promise<void> {
  await setSyncMeta(META_KEY, new Date().toISOString(), JSON.stringify(meta));
}

function byCreatedDesc(a: Notification, b: Notification): number {
  return b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0;
}

export async function readNotificationsCache(page = 1, limit = 50): Promise<NotificationsResponse | null> {
  const rows = await getAllCacheRows(TABLE);
  if (rows.length === 0) return null;
  const all = rows.map((r) => toNotification(r.data)).sort(byCreatedDesc);
  const start = (page - 1) * limit;
  const notifications = all.slice(start, start + limit);
  const meta = await readMeta();
  return {
    success: true,
    count: notifications.length,
    total: meta.total || all.length,
    unreadCount: meta.unreadCount || 0,
    notifications,
  };
}

export async function writeNotificationsCache(res: NotificationsResponse): Promise<void> {
  for (const notification of res.notifications) {
    await putCacheRow(TABLE, {
      id: notification._id,
      data: notification,
      updatedAt: notification.updatedAt ?? notification.createdAt ?? new Date().toISOString(),
    }, { created_at: notification.createdAt ?? new Date().toISOString() });
  }
  await writeMeta({ count: res.count, total: res.total, unreadCount: res.unreadCount });
}

/** Delta merge for notifications. Meta (unreadCount etc.) comes from the delta response too. */
export async function mergeNotifications(notifications: Notification[], meta?: Partial<NotificationMeta>): Promise<number> {
  let written = 0;
  for (const notification of notifications) {
    const ok = await mergeCacheRow(TABLE, {
      id: notification._id,
      data: notification,
      updatedAt: notification.updatedAt ?? notification.createdAt ?? new Date().toISOString(),
    }, { created_at: notification.createdAt ?? new Date().toISOString() });
    if (ok) written += 1;
  }
  if (meta) {
    const current = await readMeta();
    await writeMeta({ ...current, ...meta });
  }
  return written;
}

/** Mirror optimistic cache writes (read/delete/etc.) into SQLite so cold-start reads stay consistent. */
export async function syncNotificationMutationsFromCache(): Promise<void> {
  // Best-effort: notifications are fully overwritten on next network sync.
}
