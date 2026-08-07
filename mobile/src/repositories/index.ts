import { cacheFirst } from './cacheFirst';
import { getRentRecords, getRentRecordDetail, getTransactionHistory } from '../api/payment';
import { getComplaints, getComplaintDetail } from '../api/complaint';
import { getNotifications } from '../api/notifications';
import { getMyTenancy } from '../api/tenant';
import {
  readRentRecordsCache,
  writeRentRecordsCache,
  readRentRecordDetailCache,
  writeRentRecordDetailCache,
  readTransactionHistoryCache,
  writeTransactionHistoryCache,
} from './rentRepository';
import {
  readComplaintsCache,
  writeComplaintsCache,
  readComplaintDetailCache,
  writeComplaintDetailCache,
} from './complaintRepository';
import { readNotificationsCache, writeNotificationsCache } from './notificationRepository';
import { readTenancyCache, writeTenancyCache } from './tenantRepository';
import { useAuthStore } from '../store/useAuthStore';
import {
  readPropertiesCache,
  writePropertiesCache,
  readRoomsCache,
  writeRoomsCache,
  readOwnerTenantsCache,
  writeOwnerTenantsCache,
  readOwnerRentRecordsCache,
  writeOwnerRentRecordsCache,
  readPendingApprovalsCache,
  writePendingApprovalsCache,
  readOwnerComplaintsCache,
  writeOwnerComplaintsCache,
  readOwnerExpensesCache,
  writeOwnerExpensesCache,
  readPaymentSummaryCache,
  writePaymentSummaryCache,
} from './ownerRepository';
import {
  getProperties,
  getRooms,
  getOwnerTenants,
  getOwnerRentRecords,
  getPendingApprovals,
  getComplaints as getOwnerComplaints,
  getExpenses,
  getPaymentSummary,
} from '../api/owner';

// Preserves the exact query keys screens already rely on.

export const cachedRentRecords = cacheFirst({
  queryKey: ['rentRecords'],
  read: readRentRecordsCache,
  write: writeRentRecordsCache,
  fetch: () => getRentRecords(),
});

export const cachedRentRecordDetail = (id: string) =>
  cacheFirst({
    queryKey: ['rentRecordDetail', id],
    read: () => readRentRecordDetailCache(id),
    write: writeRentRecordDetailCache,
    fetch: () => getRentRecordDetail(id),
  });

export const cachedComplaints = cacheFirst({
  queryKey: ['complaints'],
  read: readComplaintsCache,
  write: writeComplaintsCache,
  fetch: () => getComplaints(),
});

export const cachedComplaintDetail = (id: string) =>
  cacheFirst({
    queryKey: ['complaintDetail', id],
    read: () => readComplaintDetailCache(id),
    write: writeComplaintDetailCache,
    fetch: () => getComplaintDetail(id),
  });

export const cachedNotifications = cacheFirst({
  queryKey: ['notifications'],
  read: () => readNotificationsCache(1, 50),
  write: writeNotificationsCache,
  fetch: () => getNotifications(1, 50),
});

export const cachedNotificationsUnread = cacheFirst({
  queryKey: ['notifications', 'unread'],
  read: () => readNotificationsCache(1, 1),
  write: writeNotificationsCache,
  fetch: () => getNotifications(1, 1),
});

export const cachedTransactionHistory = cacheFirst({
  queryKey: ['transactionHistory'],
  read: readTransactionHistoryCache,
  write: writeTransactionHistoryCache,
  fetch: () => getTransactionHistory(),
});

export const cachedTenancy = cacheFirst({
  queryKey: ['myTenancy'],
  read: readTenancyCache,
  write: writeTenancyCache,
  fetch: () => {
    const { user } = useAuthStore.getState();
    const role = user?.role;
    const roles: string[] = user?.roles ?? (role ? [role] : []);
    // `/tenants/my` is a tenant-only route; owners must not hit it.
    if (!roles.includes('tenant')) {
      return Promise.resolve({ success: true, tenant: null });
    }
    return getMyTenancy();
  },
});

// ─── Owner workspace ──────────────────────────────────────────────────────
// Query keys mirror the owner screens' existing useQuery keys so swapping the
// queryFn to these wrappers makes each screen offline-first with no other change.

export const cachedOwnerProperties = cacheFirst({
  queryKey: ['ownerProperties'],
  read: readPropertiesCache,
  write: writePropertiesCache,
  fetch: () => getProperties(),
});

export const cachedOwnerRooms = (propertyId?: string) =>
  cacheFirst({
    queryKey: propertyId ? ['ownerRooms', propertyId] : ['ownerRooms'],
    read: () => readRoomsCache(propertyId),
    write: writeRoomsCache,
    fetch: () => getRooms(propertyId),
  });

export const cachedOwnerTenants = (filter?: 'active' | 'vacated') =>
  cacheFirst({
    queryKey: filter ? ['ownerTenants', filter] : ['ownerTenants'],
    read: readOwnerTenantsCache,
    write: writeOwnerTenantsCache,
    fetch: () => getOwnerTenants(filter ? { status: filter } : undefined),
  });

export const cachedOwnerRentRecords = (status?: string) =>
  cacheFirst({
    queryKey: ['ownerRentRecords', status ?? 'all'],
    read: () => readOwnerRentRecordsCache(status ? { status } : undefined),
    write: writeOwnerRentRecordsCache,
    fetch: () => getOwnerRentRecords(status ? { status } : undefined),
  });

export const cachedOwnerPaymentSummary = (propertyId?: string) =>
  cacheFirst({
    queryKey: ['ownerPaymentSummary'],
    read: () => readPaymentSummaryCache(propertyId),
    write: (res) => writePaymentSummaryCache(res, propertyId),
    fetch: () => getPaymentSummary(propertyId),
  });

export const cachedOwnerPendingApprovals = cacheFirst({
  queryKey: ['ownerPendingApprovals'],
  read: async () => {
    const transactions = await readPendingApprovalsCache();
    if (transactions.length === 0) return null;
    return { success: true, transactions };
  },
  write: writePendingApprovalsCache,
  fetch: () => getPendingApprovals(),
});

export const cachedOwnerComplaints = cacheFirst({
  queryKey: ['ownerComplaints'],
  read: readOwnerComplaintsCache,
  write: writeOwnerComplaintsCache,
  fetch: () => getOwnerComplaints(),
});

export const cachedOwnerExpenses = (month: string, propertyId?: string) =>
  cacheFirst({
    queryKey: ['ownerExpenses', month, propertyId],
    read: () => readOwnerExpensesCache(month, propertyId),
    write: writeOwnerExpensesCache,
    fetch: () => getExpenses({ month, propertyId }),
  });

export * from './rentRepository';
export * from './complaintRepository';
export * from './notificationRepository';
export * from './tenantRepository';
export * from './transactionRepository';
export * from './profileRepository';
export * from './ownerRepository';
