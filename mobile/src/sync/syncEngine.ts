import { AppState } from 'react-native';
import {
  getPendingOutbox,
  markOutboxDone,
  markOutboxFailed,
  markOutboxUploading,
  requeueFailedOutbox,
  OutboxItem,
} from '../db/outbox';
import { kvGet, kvRemove, kvSet } from '../db/kv';
import { queryClient } from '../queryClient';
import {
  markAsReadRequest,
  markAllAsReadRequest,
  deleteNotificationRequest,
  clearAllNotificationsRequest,
  getNotifications,
  NotificationsResponse,
} from '../api/notifications';
import { createComplaintRequest, createComplaintFormData, getComplaints } from '../api/complaint';
import {
  getRentRecords,
  submitManualPaymentRequest,
  createManualPaymentFormData,
  getTransactionHistory,
} from '../api/payment';
import { updateProfileRequest } from '../api/user';
import { getMyTenancy } from '../api/tenant';
import {
  createProperty,
  updateProperty,
  deleteProperty,
  createRoom,
  updateRoom,
  deleteRoom,
  addTenant,
  updateTenant,
  moveOutTenant,
  reverseMoveOutTenant,
  markRefundSettled,
  verifyTransaction,
  rejectTransaction,
  reverseTransaction,
  updateComplaint,
  createExpense,
  updateExpense,
  deleteExpense,
  getProperties,
  getRooms,
  getOwnerTenants,
  getOwnerRentRecords,
  getPendingApprovals,
  getComplaints as getOwnerComplaints,
  getPaymentSummary,
} from '../api/owner';
import { RentRecord } from '../types/payment';
import { initNetworkMonitor, isOnline, subscribeToOnline } from './networkStatus';
import {
  mergeRentRecords,
  mergeComplaints,
  mergeNotifications,
  writeTenancyCache,
  writeTransactionHistoryCache,
  pruneComplaintsCache,
  pruneRentRecordsCache,
  mergeProperties,
  mergeRooms,
  mergeOwnerTenants,
  mergeOwnerRentRecords,
  mergeOwnerTransactions,
  mergeOwnerComplaints,
  writePaymentSummaryCache,
  prunePropertiesCache,
  pruneRoomsCache,
  pruneOwnerTenantsCache,
  pruneOwnerRentRecordsCache,
  pruneOwnerComplaintsCache,
  pruneOwnerExpensesCache,
} from '../repositories';
import { removeOutboxImage } from '../utils/outboxImages';

// Lazy accessor to avoid circular dependency: syncEngine ← useAuthStore ← syncEngine
const getAuthStore = () => require('../store/useAuthStore').useAuthStore;

const LAST_RENT_SYNC_KEY = 'lastRentSyncAt';
const LAST_COMPLAINTS_SYNC_KEY = 'lastComplaintsSyncAt';
const LAST_NOTIFICATIONS_SYNC_KEY = 'lastNotificationsSyncAt';
const LAST_TX_SYNC_KEY = 'lastTxSyncAt';

const PERIODIC_SYNC_MS = 30 * 1000;

/** Remove all per-collection sync cursors. Used on logout. */
export async function clearSyncCursors(): Promise<void> {
  await Promise.all([
    kvRemove(LAST_RENT_SYNC_KEY),
    kvRemove(LAST_COMPLAINTS_SYNC_KEY),
    kvRemove(LAST_NOTIFICATIONS_SYNC_KEY),
    kvRemove(LAST_TX_SYNC_KEY),
  ]);
}

let running = false;
let periodicTimer: ReturnType<typeof setInterval> | null = null;

// ─────────────────────────────────────────────────────────────────────────
// Outbox dispatch
// ─────────────────────────────────────────────────────────────────────────

async function dispatch(item: OutboxItem): Promise<void> {
  switch (item.kind) {
    case 'notification.read':
      if (!item.entityId) throw new Error('Missing entityId');
      await markAsReadRequest(item.entityId);
      break;
    case 'notification.readAll':
      await markAllAsReadRequest();
      break;
    case 'notification.delete':
      if (!item.entityId) throw new Error('Missing entityId');
      await deleteNotificationRequest(item.entityId);
      break;
    case 'notification.clearAll':
      await clearAllNotificationsRequest();
      break;
    case 'complaint.create': {
      await createComplaintRequest(
        createComplaintFormData({
          title: String(item.payload.title ?? ''),
          description: String(item.payload.description ?? ''),
          priority: String(item.payload.priority ?? 'medium'),
          category: String(item.payload.category ?? 'other'),
          imageUri: typeof item.payload.imageUri === 'string' ? item.payload.imageUri : undefined,
        })
      );
      await removeOutboxImage(typeof item.payload.imageUri === 'string' ? item.payload.imageUri : undefined);
      break;
    }
    case 'payment.create': {
      const payload = item.payload;
      const formData = createManualPaymentFormData({
        rentRecordId: String(payload.rentRecordId),
        amount: Number(payload.amount),
        paymentMethod: String(payload.paymentMethod ?? 'upi'),
        transactionId: payload.transactionId ? String(payload.transactionId) : undefined,
        note: payload.note ? String(payload.note) : undefined,
        imageUri: typeof payload.imageUri === 'string' ? payload.imageUri : undefined,
        idempotencyKey: String(payload.idempotencyKey ?? item.id),
      });
      try {
        await submitManualPaymentRequest(String(payload.rentRecordId), formData);
      } catch (error: any) {
        if (error?.response?.status === 409) return;
        throw error;
      }
      await removeOutboxImage(typeof payload.imageUri === 'string' ? payload.imageUri : undefined);
      break;
    }
    case 'profile.update': {
      const userData = item.payload as Record<string, unknown>;
      const res = await updateProfileRequest(userData);
      const { user, token } = getAuthStore().getState();
      if (token && res.user) {
        await getAuthStore().getState().setAuth(res.user, token);
      }
      break;
    }
    case 'owner.property.create':
      await createProperty(item.payload as any);
      break;
    case 'owner.property.update':
      if (!item.entityId) throw new Error('Missing entityId');
      await updateProperty(item.entityId, item.payload as any);
      break;
    case 'owner.property.delete':
      if (!item.entityId) throw new Error('Missing entityId');
      await deleteProperty(item.entityId);
      break;
    case 'owner.room.create':
      await createRoom(item.payload as any);
      break;
    case 'owner.room.update':
      if (!item.entityId) throw new Error('Missing entityId');
      await updateRoom(item.entityId, item.payload as any);
      break;
    case 'owner.room.delete':
      if (!item.entityId) throw new Error('Missing entityId');
      await deleteRoom(item.entityId);
      break;
    case 'owner.tenant.add':
      await addTenant(item.payload as any);
      break;
    case 'owner.tenant.update':
      if (!item.entityId) throw new Error('Missing entityId');
      await updateTenant(item.entityId, item.payload as any);
      break;
    case 'owner.tenant.moveOut': {
      if (!item.entityId) throw new Error('Missing entityId');
      await moveOutTenant(item.entityId, {
        exitDate: String(item.payload.exitDate ?? new Date().toISOString()),
        notes: item.payload.notes ? String(item.payload.notes) : undefined,
      });
      break;
    }
    case 'owner.tenant.reverseMoveOut':
      if (!item.entityId) throw new Error('Missing entityId');
      await reverseMoveOutTenant(item.entityId);
      break;
    case 'owner.tenant.markRefundSettled':
      if (!item.entityId) throw new Error('Missing entityId');
      await markRefundSettled(item.entityId, item.payload.note ? String(item.payload.note) : undefined);
      break;
    case 'owner.transaction.verify':
      if (!item.entityId) throw new Error('Missing entityId');
      await verifyTransaction(item.entityId);
      break;
    case 'owner.transaction.reject':
      if (!item.entityId) throw new Error('Missing entityId');
      await rejectTransaction(item.entityId, String(item.payload.reason ?? 'Rejected by owner'));
      break;
    case 'owner.transaction.reverse':
      if (!item.entityId) throw new Error('Missing entityId');
      await reverseTransaction(item.entityId, String(item.payload.reason ?? 'Reversed by owner'));
      break;
    case 'owner.complaint.update':
      if (!item.entityId) throw new Error('Missing entityId');
      await updateComplaint(item.entityId, item.payload as any);
      break;
    case 'owner.expense.create':
      await createExpense(item.payload as any);
      break;
    case 'owner.expense.update':
      if (!item.entityId) throw new Error('Missing entityId');
      await updateExpense(item.entityId, item.payload as any);
      break;
    case 'owner.expense.delete':
      if (!item.entityId) throw new Error('Missing entityId');
      await deleteExpense(item.entityId);
      break;
    default:
      throw new Error(`Unknown outbox kind: ${String((item as any).kind)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Outbox flush
// ─────────────────────────────────────────────────────────────────────────

export async function flushOutbox(): Promise<void> {
  if (!isOnline()) return;

  const items = await getPendingOutbox();
  if (items.length === 0) return;

  const affectedRentRecords = new Set<string>();
  for (const item of items) {
    if (!isOnline()) break;
    await markOutboxUploading(item.id);
    try {
      await dispatch(item);
      await markOutboxDone(item.id);
      if (item.kind === 'payment.create' && item.payload?.rentRecordId) {
        affectedRentRecords.add(String(item.payload.rentRecordId));
      }
    } catch (error: any) {
      if (__DEV__) console.warn('[Sync] Outbox item failed', item.kind, error?.message);
      await markOutboxFailed(item.id, error?.message || 'Sync failed');
    }
  }

  // Uploaded local rows are no longer pending — prune them from the SQLite cache.
  await pruneComplaintsCache();
  await pruneRentRecordsCache();
  await prunePropertiesCache();
  await pruneRoomsCache();
  await pruneOwnerTenantsCache();
  await pruneOwnerRentRecordsCache();
  await pruneOwnerComplaintsCache();
  await pruneOwnerExpensesCache();

  for (const id of affectedRentRecords) {
    queryClient.invalidateQueries({ queryKey: ['rentRecordDetail', id] });
  }
  queryClient.invalidateQueries({ queryKey: ['complaints'] });
  queryClient.invalidateQueries({ queryKey: ['complaintDetail'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
  queryClient.invalidateQueries({ queryKey: ['transactionHistory'] });
  queryClient.invalidateQueries({ queryKey: ['ownerProperties'] });
  queryClient.invalidateQueries({ queryKey: ['ownerRooms'] });
  queryClient.invalidateQueries({ queryKey: ['ownerTenants'] });
  queryClient.invalidateQueries({ queryKey: ['ownerRentRecords'] });
  queryClient.invalidateQueries({ queryKey: ['ownerComplaints'] });
  queryClient.invalidateQueries({ queryKey: ['ownerPendingApprovals'] });
  queryClient.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
  queryClient.invalidateQueries({ queryKey: ['ownerExpenses'] });
  queryClient.invalidateQueries({ queryKey: ['ownerPaymentDetail'] });
}

// ─────────────────────────────────────────────────────────────────────────
// Delta syncs (per-collection lastSync cursor)
// ─────────────────────────────────────────────────────────────────────────

export async function syncRentRecordsIncremental(): Promise<void> {
  if (!isOnline()) return;
  try {
    const lastSync = await kvGet(LAST_RENT_SYNC_KEY);
    const hasCache = queryClient.getQueryData(['rentRecords']) !== undefined;
    const res = await getRentRecords(lastSync && hasCache ? lastSync : undefined);
    if (res?.rentRecords?.length) {
      await mergeRentRecords(res.rentRecords);
      queryClient.setQueryData(['rentRecords'], (old: any) => {
        const base = old || { success: true, count: 0, rentRecords: [] };
        const map = new Map<string, RentRecord>();
        for (const r of base.rentRecords || []) map.set(r._id, r);
        for (const r of res.rentRecords) map.set(r._id, r);
        const rentRecords = Array.from(map.values()).sort((a, b) =>
          b.month < a.month ? -1 : b.month > a.month ? 1 : 0
        );
        return { ...base, count: rentRecords.length, rentRecords };
      });
    }
    await kvSet(LAST_RENT_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Incremental rent sync failed', error);
  }
}

export async function syncComplaintsDelta(): Promise<void> {
  if (!isOnline()) return;
  try {
    const lastSync = await kvGet(LAST_COMPLAINTS_SYNC_KEY);
    const hasCache = queryClient.getQueryData(['complaints']) !== undefined;
    const res = await getComplaints(lastSync && hasCache ? lastSync : undefined);
    if (res?.complaints?.length) {
      await mergeComplaints(res.complaints);
      queryClient.setQueryData(['complaints'], (old: any) => {
        const base = old || { success: true, count: 0, complaints: [] };
        const map = new Map<string, any>();
        for (const c of base.complaints || []) map.set(c._id, c);
        for (const c of res.complaints) map.set(c._id, c);
        const complaints = Array.from(map.values()).sort((a, b) =>
          b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0
        );
        return { ...base, count: complaints.length, complaints };
      });
    }
    await kvSet(LAST_COMPLAINTS_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Incremental complaints sync failed', error);
  }
}

function mergeNotificationsIntoCache(res: NotificationsResponse) {
  queryClient.setQueryData(['notifications'], (old: any) => {
    const base = old || { success: true, count: 0, total: 0, unreadCount: 0, notifications: [] };
    const map = new Map<string, any>();
    for (const n of base.notifications || []) map.set(n._id, n);
    for (const n of res.notifications || []) map.set(n._id, n);
    const notifications = Array.from(map.values()).sort((a, b) =>
      b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0
    );
    return {
      ...base,
      count: notifications.length,
      total: res.total ?? base.total,
      unreadCount: res.unreadCount ?? base.unreadCount,
      notifications,
    };
  });
  queryClient.setQueryData(['notifications', 'unread'], (old: any) => {
    const base = old || { success: true, count: 0, total: 0, unreadCount: 0, notifications: [] };
    return { ...base, total: res.total ?? base.total, unreadCount: res.unreadCount ?? base.unreadCount };
  });
}

export async function syncNotificationsDelta(): Promise<void> {
  if (!isOnline()) return;
  try {
    const lastSync = await kvGet(LAST_NOTIFICATIONS_SYNC_KEY);
    const hasCache = queryClient.getQueryData(['notifications']) !== undefined;
    const res = await getNotifications(1, 50, lastSync && hasCache ? lastSync : undefined);
    if (res?.notifications?.length) {
      await mergeNotifications(res.notifications, {
        count: res.count,
        total: res.total,
        unreadCount: res.unreadCount,
      });
      mergeNotificationsIntoCache(res);
    }
    await kvSet(LAST_NOTIFICATIONS_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Incremental notifications sync failed', error);
  }
}

export async function syncTransactionHistoryDelta(): Promise<void> {
  if (!isOnline()) return;
  try {
    const lastSync = await kvGet(LAST_TX_SYNC_KEY);
    const hasCache = queryClient.getQueryData(['transactionHistory']) !== undefined;
    const res = await getTransactionHistory(lastSync && hasCache ? lastSync : undefined);
    if (res?.transactions?.length) {
      await writeTransactionHistoryCache(res);
      queryClient.setQueryData(['transactionHistory'], (old: any) => {
        const base = old || { success: true, count: 0, transactions: [] };
        const map = new Map<string, any>();
        for (const t of base.transactions || []) map.set(t._id, t);
        for (const t of res.transactions) map.set(t._id, t);
        const transactions = Array.from(map.values()).sort((a, b) =>
          b.paymentDate < a.paymentDate ? -1 : b.paymentDate > a.paymentDate ? 1 : 0
        );
        return { ...base, count: transactions.length, transactions };
      });
    }
    await kvSet(LAST_TX_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Incremental transaction sync failed', error);
  }
}

export async function syncTenancy(): Promise<void> {
  if (!isOnline()) return;
  const role = getAuthStore().getState().user?.role;
  const roles: string[] = getAuthStore().getState().user?.roles ?? (role ? [role] : []);
  if (!roles.includes('tenant')) return;
  try {
    const res = await getMyTenancy();
    await writeTenancyCache(res);
    queryClient.setQueryData(['myTenancy'], res);
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Tenancy sync failed', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Owner workspace sync (full-merge, guarded by activeWorkspace === 'owner')
// ─────────────────────────────────────────────────────────────────────────

function isOwnerWorkspace(): boolean {
  return getAuthStore().getState().activeWorkspace === 'owner';
}

function ownerSetQuery<T>(key: unknown[], data: T): void {
  queryClient.setQueryData(key, data);
}

export async function syncOwnerPropertiesDelta(): Promise<void> {
  if (!isOnline() || !isOwnerWorkspace()) return;
  try {
    const res = await getProperties();
    if (res?.properties?.length) {
      await mergeProperties(res.properties);
      ownerSetQuery(['ownerProperties'], res);
    }
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Owner properties sync failed', error);
  }
}

export async function syncOwnerRoomsDelta(): Promise<void> {
  if (!isOnline() || !isOwnerWorkspace()) return;
  try {
    const res = await getRooms();
    if (res?.rooms?.length) {
      await mergeRooms(res.rooms);
      ownerSetQuery(['ownerRooms'], res);
    }
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Owner rooms sync failed', error);
  }
}

export async function syncOwnerTenantsDelta(): Promise<void> {
  if (!isOnline() || !isOwnerWorkspace()) return;
  try {
    const res = await getOwnerTenants();
    if (res?.tenants?.length) {
      await mergeOwnerTenants(res.tenants);
      ownerSetQuery(['ownerTenants'], res);
      ownerSetQuery(['ownerTenants', 'active'], {
        ...res,
        tenants: res.tenants.filter((t) => t.status === 'active'),
      });
    }
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Owner tenants sync failed', error);
  }
}

export async function syncOwnerRentRecordsDelta(): Promise<void> {
  if (!isOnline() || !isOwnerWorkspace()) return;
  try {
    const res = await getOwnerRentRecords();
    if (res?.rentRecords?.length) {
      await mergeOwnerRentRecords(res.rentRecords);
      ownerSetQuery(['ownerRentRecords', 'all'], res);
    }
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Owner rent records sync failed', error);
  }
}

export async function syncOwnerComplaintsDelta(): Promise<void> {
  if (!isOnline() || !isOwnerWorkspace()) return;
  try {
    const res = await getOwnerComplaints();
    if (res?.complaints?.length) {
      await mergeOwnerComplaints(res.complaints);
      ownerSetQuery(['ownerComplaints'], res);
    }
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Owner complaints sync failed', error);
  }
}

export async function syncOwnerApprovalsDelta(): Promise<void> {
  if (!isOnline() || !isOwnerWorkspace()) return;
  try {
    const res = await getPendingApprovals();
    if (res?.transactions?.length) {
      await mergeOwnerTransactions(res.transactions);
      ownerSetQuery(['ownerPendingApprovals'], res);
    }
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Owner approvals sync failed', error);
  }
}

export async function syncOwnerPaymentSummaryDelta(): Promise<void> {
  if (!isOnline() || !isOwnerWorkspace()) return;
  try {
    const res = await getPaymentSummary();
    await writePaymentSummaryCache(res);
    ownerSetQuery(['ownerPaymentSummary'], res);
  } catch (error) {
    if (__DEV__) console.warn('[Sync] Owner payment summary sync failed', error);
  }
}

export async function syncOwnerWorkspace(): Promise<void> {
  await Promise.allSettled([
    syncOwnerPropertiesDelta(),
    syncOwnerRoomsDelta(),
    syncOwnerTenantsDelta(),
    syncOwnerRentRecordsDelta(),
    syncOwnerComplaintsDelta(),
    syncOwnerApprovalsDelta(),
    syncOwnerPaymentSummaryDelta(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Full sync (launch / reconnect / foreground)
// ─────────────────────────────────────────────────────────────────────────

const SYNCED_KEYS = new Set([
  'rentRecords',
  'complaints',
  'notifications',
  'transactionHistory',
  'myTenancy',
  'ownerProperties',
  'ownerRooms',
  'ownerTenants',
  'ownerRentRecords',
  'ownerComplaints',
  'ownerPendingApprovals',
  'ownerPaymentSummary',
]);

export async function syncAll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!isOnline()) return;
    await requeueFailedOutbox();
    await flushOutbox();
    await Promise.allSettled([
      syncRentRecordsIncremental(),
      syncComplaintsDelta(),
      syncNotificationsDelta(),
      syncTransactionHistoryDelta(),
      syncTenancy(),
      syncOwnerWorkspace(),
    ]);
    await queryClient.invalidateQueries({
      predicate: (query) => !SYNCED_KEYS.has(String(query.queryKey[0])),
    });
  } catch (error) {
    if (__DEV__) console.warn('[Sync] syncAll failed', error);
  } finally {
    running = false;
  }
}

/** Lightweight periodic sync — flush the offline queue + rent delta only. */
async function syncPeriodic(): Promise<void> {
  if (!isOnline()) return;
  try {
    await requeueFailedOutbox();
    await flushOutbox();
    await syncRentRecordsIncremental();
  } catch (error) {
    if (__DEV__) console.warn('[Sync] periodic sync failed', error);
  }
}

function startPeriodicSync(): void {
  if (periodicTimer) return;
  periodicTimer = setInterval(() => {
    syncPeriodic().catch(() => {});
  }, PERIODIC_SYNC_MS);
}

function stopPeriodicSync(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Engine bootstrap
// ─────────────────────────────────────────────────────────────────────────

let started = false;
let appStateSub: { remove(): void } | null = null;

export function startSyncEngine(): () => void {
  if (started) return () => {};
  started = true;

  initNetworkMonitor();
  startPeriodicSync();

  const unsubscribe = subscribeToOnline((online) => {
    if (online) {
      syncAll();
    }
  });

  const appStateSubRef = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      syncAll();
    }
  });
  appStateSub = appStateSubRef;

  setTimeout(() => {
    syncAll();
  }, 0);

  return () => {
    stopSyncEngine();
  };
}

/** Stop all sync activity. Used on logout so token-less requests aren't fired. */
export function stopSyncEngine(): void {
  if (!started) return;
  started = false;
  stopPeriodicSync();
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}
