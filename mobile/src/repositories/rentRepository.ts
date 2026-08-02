import {
  TABLES,
  getAllCacheRows,
  getCacheRow,
  getCacheRowsWhere,
  mergeCacheRow,
  putCacheRow,
  deleteCacheRow,
} from '../db/cacheRepo';
import { RentRecord, RentRecordsResponse, RentRecordDetailResponse, PaymentTransaction } from '../types/payment';

const RENT_TABLE = TABLES.rentRecords;
const TX_TABLE = TABLES.paymentTransactions;

function byMonthDesc(a: RentRecord, b: RentRecord): number {
  return b.month < a.month ? -1 : b.month > a.month ? 1 : 0;
}

function toRentRecord(data: unknown): RentRecord {
  return data as RentRecord;
}

function toTransaction(data: unknown): PaymentTransaction {
  return data as PaymentTransaction;
}

// ── Rent records list ────────────────────────────────────────────────────

export async function readRentRecordsCache(): Promise<RentRecordsResponse | null> {
  const rows = await getAllCacheRows(RENT_TABLE);
  if (rows.length === 0) return null;
  const rentRecords = rows.map((r) => toRentRecord(r.data)).sort(byMonthDesc);
  return { success: true, count: rentRecords.length, rentRecords };
}

export async function writeRentRecordsCache(res: RentRecordsResponse): Promise<void> {
  for (const record of res.rentRecords) {
    await putCacheRow(RENT_TABLE, {
      id: record._id,
      data: record,
      updatedAt: record.updatedAt ?? new Date().toISOString(),
    }, { month: record.month });
  }
}

/** Delta merge: upsert only changed records. Returns count actually written. */
export async function mergeRentRecords(records: RentRecord[]): Promise<number> {
  let written = 0;
  for (const record of records) {
    const ok = await mergeCacheRow(RENT_TABLE, {
      id: record._id,
      data: record,
      updatedAt: record.updatedAt ?? new Date().toISOString(),
    }, { month: record.month });
    if (ok) written += 1;
  }
  return written;
}

export async function deleteRentRecordCache(id: string): Promise<void> {
  await deleteCacheRow(RENT_TABLE, id);
}

// ── Rent record detail ───────────────────────────────────────────────────

export async function readRentRecordDetailCache(id: string): Promise<RentRecordDetailResponse | null> {
  const record = await getCacheRow(RENT_TABLE, id);
  if (!record) return null;
  const txRows = await getCacheRowsWhere(TX_TABLE, 'rent_record_id', id);
  const transactions = txRows
    .map((r) => toTransaction(r.data))
    .sort((a, b) => (b.paymentDate < a.paymentDate ? -1 : b.paymentDate > a.paymentDate ? 1 : 0));
  return { success: true, rentRecord: toRentRecord(record.data), transactions };
}

export async function writeRentRecordDetailCache(detail: RentRecordDetailResponse): Promise<void> {
  await putCacheRow(RENT_TABLE, {
    id: detail.rentRecord._id,
    data: detail.rentRecord,
    updatedAt: detail.rentRecord.updatedAt ?? new Date().toISOString(),
  }, { month: detail.rentRecord.month });
  for (const tx of detail.transactions) {
    await putCacheRow(TX_TABLE, {
      id: tx._id,
      data: tx,
      updatedAt: new Date().toISOString(),
    }, { rent_record_id: detail.rentRecord._id });
  }
}

export async function mergeTransactions(transactions: PaymentTransaction[]): Promise<number> {
  let written = 0;
  for (const tx of transactions) {
    const ok = await mergeCacheRow(TX_TABLE, {
      id: tx._id,
      data: tx,
      updatedAt: new Date().toISOString(),
    }, { rent_record_id: tx.rentRecordId });
    if (ok) written += 1;
  }
  return written;
}

// ── Transaction history ──────────────────────────────────────────────────

export async function readTransactionHistoryCache() {
  const rows = await getAllCacheRows(TX_TABLE);
  if (rows.length === 0) return null;
  const transactions = rows
    .map((r) => toTransaction(r.data))
    .sort((a, b) => (b.paymentDate < a.paymentDate ? -1 : b.paymentDate > a.paymentDate ? 1 : 0));
  return { success: true, count: transactions.length, transactions };
}

export async function writeTransactionHistoryCache(res: { transactions: PaymentTransaction[] }): Promise<void> {
  for (const tx of res.transactions) {
    await putCacheRow(TX_TABLE, {
      id: tx._id,
      data: tx,
      updatedAt: new Date().toISOString(),
    }, { rent_record_id: tx.rentRecordId });
  }
}

// ── Pruning ──────────────────────────────────────────────────────────────

export async function pruneRentRecordsCache(): Promise<void> {
  const rows = await getAllCacheRows(RENT_TABLE);
  for (const row of rows) {
    if (String(row.id).startsWith('local-')) await deleteCacheRow(RENT_TABLE, row.id);
  }
}
