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
  fetch: () => getMyTenancy(),
});

export * from './rentRepository';
export * from './complaintRepository';
export * from './notificationRepository';
export * from './tenantRepository';
export * from './transactionRepository';
export * from './profileRepository';
