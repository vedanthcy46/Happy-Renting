/**
 * ownerRepository.ts
 * SQLite cache read/write/merge functions for the owner workspace, mirroring the
 * tenant repositories (tenantRepository / complaintRepository / rentRepository).
 * All collections store the full entity as JSON plus a serializable updated_at.
 */
import {
  TABLES,
  getAllCacheRows,
  getCacheRow,
  getCacheRowsWhere,
  putCacheRow,
  mergeCacheRow,
  deleteCacheRow,
} from '../db/cacheRepo';
import type {
  Property,
  Room,
  OwnerTenant,
  OwnerRentRecord,
  OwnerTransaction,
  OwnerComplaint,
  OwnerExpense,
  PaymentSummaryMetrics,
  OwnerRentRecordMeta,
} from '../api/owner';

type Table = (typeof TABLES)[keyof typeof TABLES];

const now = () => new Date().toISOString();

function tsOf<T extends { updatedAt?: string; updated_at?: string; createdAt?: string }>(row: T): string {
  return row.updatedAt ?? row.updated_at ?? row.createdAt ?? now();
}

function propId(propertyId: Property['_id'] | { _id: string } | undefined): string | null {
  if (!propertyId) return null;
  return typeof propertyId === 'string' ? propertyId : propertyId._id;
}

async function readList<T>(table: Table, sort: (a: T, b: T) => number): Promise<T[]> {
  const rows = await getAllCacheRows(table);
  return rows.map((r) => r.data as T).sort(sort);
}

async function writeList<T>(table: Table, items: T[], extra?: (item: T) => Record<string, string>): Promise<void> {
  for (const item of items) {
    await putCacheRow(table, { id: (item as any)._id, data: item, updatedAt: tsOf(item as any) }, extra?.(item));
  }
}

async function mergeList<T>(table: Table, items: T[], extra?: (item: T) => Record<string, string>): Promise<number> {
  let written = 0;
  for (const item of items) {
    const ok = await mergeCacheRow(table, { id: (item as any)._id, data: item, updatedAt: tsOf(item as any) }, extra?.(item));
    if (ok) written += 1;
  }
  return written;
}

/** Delete locally-created rows ('local-*' ids) whose outbox op has completed. */
async function pruneLocalRows(table: Table): Promise<void> {
  const rows = await getAllCacheRows(table);
  for (const row of rows) {
    if (String(row.id).startsWith('local-')) await deleteCacheRow(table, row.id);
  }
}

// ─── Properties ───────────────────────────────────────────────────────────

const byPropertyName = (a: Property, b: Property) => a.name.localeCompare(b.name);

export async function readPropertiesCache(): Promise<{ success: boolean; count: number; properties: Property[] } | null> {
  const properties = await readList<Property>(TABLES.properties, byPropertyName);
  if (properties.length === 0) return null;
  return { success: true, count: properties.length, properties };
}

export async function writePropertiesCache(res: { properties: Property[] }): Promise<void> {
  await writeList(TABLES.properties, res.properties);
}

export async function mergeProperties(properties: Property[]): Promise<number> {
  return mergeList(TABLES.properties, properties);
}

export async function prunePropertiesCache(): Promise<void> {
  await pruneLocalRows(TABLES.properties);
}

// ─── Rooms ────────────────────────────────────────────────────────────────

const byRoomNumber = (a: Room, b: Room) => a.roomNumber.localeCompare(b.roomNumber);

const roomExtra = (room: Room) => ({ property_id: propId(room.propertyId) ?? '' });

export async function readRoomsCache(propertyId?: string): Promise<{ success: boolean; count: number; rooms: Room[] } | null> {
  const rows = propertyId ? await getCacheRowsWhere(TABLES.rooms, 'property_id', propertyId) : await getAllCacheRows(TABLES.rooms);
  if (rows.length === 0) return null;
  const rooms = rows.map((r) => r.data as Room).sort(byRoomNumber);
  return { success: true, count: rooms.length, rooms };
}

export async function writeRoomsCache(res: { rooms: Room[] }): Promise<void> {
  await writeList(TABLES.rooms, res.rooms, roomExtra);
}

export async function mergeRooms(rooms: Room[]): Promise<number> {
  return mergeList(TABLES.rooms, rooms, roomExtra);
}

export async function pruneRoomsCache(): Promise<void> {
  await pruneLocalRows(TABLES.rooms);
}

// ─── Tenants (owner view) ─────────────────────────────────────────────────

const byJoinDesc = (a: OwnerTenant, b: OwnerTenant) => (b.joinDate < a.joinDate ? -1 : b.joinDate > a.joinDate ? 1 : 0);

export async function readOwnerTenantsCache(): Promise<{ success: boolean; count: number; tenants: OwnerTenant[] } | null> {
  const tenants = await readList<OwnerTenant>(TABLES.ownerTenants, byJoinDesc);
  if (tenants.length === 0) return null;
  return { success: true, count: tenants.length, tenants };
}

export async function readOwnerTenantCache(id: string): Promise<{ success: boolean; tenant: OwnerTenant } | null> {
  const row = await getCacheRow(TABLES.ownerTenants, id);
  if (!row) return null;
  return { success: true, tenant: row.data as OwnerTenant };
}

export async function writeOwnerTenantsCache(res: { tenants: OwnerTenant[] }): Promise<void> {
  await writeList(TABLES.ownerTenants, res.tenants);
}

export async function writeOwnerTenantCache(tenant: OwnerTenant): Promise<void> {
  await putCacheRow(TABLES.ownerTenants, { id: tenant._id, data: tenant, updatedAt: tsOf(tenant) });
}

export async function mergeOwnerTenants(tenants: OwnerTenant[]): Promise<number> {
  return mergeList(TABLES.ownerTenants, tenants);
}

export async function pruneOwnerTenantsCache(): Promise<void> {
  await pruneLocalRows(TABLES.ownerTenants);
}

// ─── Owner rent records ───────────────────────────────────────────────────

const byMonthDesc = (a: OwnerRentRecord, b: OwnerRentRecord) => (b.month < a.month ? -1 : b.month > a.month ? 1 : 0);

const rentRecordExtra = (r: OwnerRentRecord) => ({
  month: r.month,
  property_id: propId(r.propertyId) ?? '',
});

export async function readOwnerRentRecordsCache(params?: {
  status?: string;
  propertyId?: string;
  month?: string;
}): Promise<{ success: boolean; count: number; rentRecords: OwnerRentRecord[] } | null> {
  const rows = await getAllCacheRows(TABLES.ownerRentRecords);
  if (rows.length === 0) return null;
  let rentRecords = rows.map((r) => r.data as OwnerRentRecord).sort(byMonthDesc);
  if (params?.status) rentRecords = rentRecords.filter((r) => r.status === params.status);
  if (params?.propertyId) rentRecords = rentRecords.filter((r) => propId(r.propertyId) === params.propertyId);
  if (params?.month) rentRecords = rentRecords.filter((r) => r.month === params.month);
  return { success: true, count: rentRecords.length, rentRecords };
}

export async function readOwnerRentRecordCache(id: string): Promise<OwnerRentRecord | null> {
  const row = await getCacheRow(TABLES.ownerRentRecords, id);
  return row ? (row.data as OwnerRentRecord) : null;
}

export async function writeOwnerRentRecordsCache(res: { rentRecords: OwnerRentRecord[] }): Promise<void> {
  await writeList(TABLES.ownerRentRecords, res.rentRecords, rentRecordExtra);
}

export async function writeOwnerRentRecordCache(record: OwnerRentRecord): Promise<void> {
  await putCacheRow(TABLES.ownerRentRecords, { id: record._id, data: record, updatedAt: tsOf(record) }, {
    month: record.month,
    property_id: propId(record.propertyId) ?? '',
  });
}

export async function mergeOwnerRentRecords(records: OwnerRentRecord[]): Promise<number> {
  return mergeList(TABLES.ownerRentRecords, records, rentRecordExtra);
}

export async function pruneOwnerRentRecordsCache(): Promise<void> {
  await pruneLocalRows(TABLES.ownerRentRecords);
}

// ─── Owner transactions (payment detail / approvals) ──────────────────────

const byPaymentDesc = (a: OwnerTransaction, b: OwnerTransaction) =>
  b.paymentDate < a.paymentDate ? -1 : b.paymentDate > a.paymentDate ? 1 : 0;

const txExtra = (tx: OwnerTransaction, rentRecordId: string) => ({ rent_record_id: rentRecordId });

export async function readOwnerTransactionsCache(rentRecordId: string): Promise<OwnerTransaction[]> {
  const rows = await getCacheRowsWhere(TABLES.ownerTransactions, 'rent_record_id', rentRecordId);
  return rows.map((r) => r.data as OwnerTransaction).sort(byPaymentDesc);
}

export async function readPendingApprovalsCache(): Promise<OwnerTransaction[]> {
  const rows = await getCacheRowsWhere(TABLES.ownerTransactions, 'rent_record_id', '');
  return rows.map((r) => r.data as OwnerTransaction).sort(byPaymentDesc);
}

export async function writePaymentDetailCache(detail: {
  rentRecord: OwnerRentRecordMeta;
  transactions: OwnerTransaction[];
}): Promise<void> {
  if (detail.rentRecord?._id) {
    await putCacheRow(TABLES.ownerRentRecords, {
      id: detail.rentRecord._id,
      data: detail.rentRecord,
      updatedAt: detail.rentRecord.month ?? now(),
    }, { month: detail.rentRecord.month, property_id: '' });
  }
  for (const tx of detail.transactions) {
    const rentRecordId = typeof tx.rentRecordId === 'object' && tx.rentRecordId ? tx.rentRecordId.month : (detail.rentRecord?._id ?? '');
    await putCacheRow(TABLES.ownerTransactions, { id: tx._id, data: tx, updatedAt: tsOf(tx) }, txExtra(tx, rentRecordId));
  }
}

export async function writePendingApprovalsCache(res: { transactions: OwnerTransaction[] }): Promise<void> {
  for (const tx of res.transactions) {
    const rentRecordId = typeof tx.rentRecordId === 'object' && tx.rentRecordId ? tx.rentRecordId.month : '';
    await putCacheRow(TABLES.ownerTransactions, { id: tx._id, data: tx, updatedAt: tsOf(tx) }, txExtra(tx, rentRecordId));
  }
}

export async function mergeOwnerTransactions(transactions: OwnerTransaction[]): Promise<number> {
  let written = 0;
  for (const tx of transactions) {
    const rentRecordId = typeof tx.rentRecordId === 'object' && tx.rentRecordId ? tx.rentRecordId.month : '';
    const ok = await mergeCacheRow(TABLES.ownerTransactions, { id: tx._id, data: tx, updatedAt: tsOf(tx) }, txExtra(tx, rentRecordId));
    if (ok) written += 1;
  }
  return written;
}

// ─── Owner complaints ─────────────────────────────────────────────────────

const byComplaintCreated = (a: OwnerComplaint, b: OwnerComplaint) => (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0);

export async function readOwnerComplaintsCache(): Promise<{ success: boolean; complaints: OwnerComplaint[] } | null> {
  const complaints = await readList<OwnerComplaint>(TABLES.ownerComplaints, byComplaintCreated);
  if (complaints.length === 0) return null;
  return { success: true, complaints };
}

export async function readOwnerComplaintCache(id: string): Promise<OwnerComplaint | null> {
  const row = await getCacheRow(TABLES.ownerComplaints, id);
  return row ? (row.data as OwnerComplaint) : null;
}

export async function writeOwnerComplaintsCache(res: { complaints: OwnerComplaint[] }): Promise<void> {
  await writeList(TABLES.ownerComplaints, res.complaints);
}

export async function mergeOwnerComplaints(complaints: OwnerComplaint[]): Promise<number> {
  return mergeList(TABLES.ownerComplaints, complaints);
}

export async function pruneOwnerComplaintsCache(): Promise<void> {
  await pruneLocalRows(TABLES.ownerComplaints);
}

// ─── Expenses ─────────────────────────────────────────────────────────────

const byExpenseDesc = (a: OwnerExpense, b: OwnerExpense) => {
  const ad = a.expenseDate ?? a.month;
  const bd = b.expenseDate ?? b.month;
  return bd < ad ? -1 : bd > ad ? 1 : 0;
};

const expenseExtra = (e: OwnerExpense) => ({ month: e.month, property_id: propId(e.propertyId) ?? '' });

export async function readOwnerExpensesCache(month: string, propertyId?: string): Promise<{ success: boolean; expenses: OwnerExpense[] } | null> {
  const rows = await getCacheRowsWhere(TABLES.ownerExpenses, 'month', month);
  if (rows.length === 0) return null;
  let expenses = rows.map((r) => r.data as OwnerExpense).sort(byExpenseDesc);
  if (propertyId) expenses = expenses.filter((e) => propId(e.propertyId) === propertyId);
  return { success: true, expenses };
}

export async function readOwnerExpenseCache(id: string): Promise<OwnerExpense | null> {
  const row = await getCacheRow(TABLES.ownerExpenses, id);
  return row ? (row.data as OwnerExpense) : null;
}

export async function writeOwnerExpensesCache(res: { expenses: OwnerExpense[] }): Promise<void> {
  await writeList(TABLES.ownerExpenses, res.expenses, expenseExtra);
}

export async function mergeOwnerExpenses(expenses: OwnerExpense[]): Promise<number> {
  return mergeList(TABLES.ownerExpenses, expenses, expenseExtra);
}

export async function deleteOwnerExpenseCache(id: string): Promise<void> {
  await deleteCacheRow(TABLES.ownerExpenses, id);
}

export async function pruneOwnerExpensesCache(): Promise<void> {
  await pruneLocalRows(TABLES.ownerExpenses);
}

// ─── Payment summary (dashboard metrics) ──────────────────────────────────

export async function readPaymentSummaryCache(propertyId?: string): Promise<{ success: boolean; metrics: PaymentSummaryMetrics } | null> {
  const key = propertyId ?? 'all';
  const row = await getCacheRow(TABLES.paymentSummary, key);
  if (!row) return null;
  return { success: true, metrics: row.data as PaymentSummaryMetrics };
}

export async function writePaymentSummaryCache(res: { metrics: PaymentSummaryMetrics }, propertyId?: string): Promise<void> {
  const key = propertyId ?? 'all';
  await putCacheRow(TABLES.paymentSummary, { id: key, data: res.metrics, updatedAt: now() });
}

export async function mergePaymentSummaryCache(res: { metrics: PaymentSummaryMetrics }, propertyId?: string): Promise<boolean> {
  const key = propertyId ?? 'all';
  return mergeCacheRow(TABLES.paymentSummary, { id: key, data: res.metrics, updatedAt: now() });
}
