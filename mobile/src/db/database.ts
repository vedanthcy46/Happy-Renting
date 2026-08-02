import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export const DB_NAME = 'happy-renting.db';

// Increment when the schema changes. All DDL below is idempotent (CREATE TABLE IF NOT EXISTS),
// so older installs simply gain the new tables on next open.
export const SCHEMA_VERSION = 2;

export const TABLES = {
  kvStore: 'kv_store',
  outbox: 'outbox',
  syncMetadata: 'sync_metadata',
  tenantProfile: 'tenant_profile',
  userProfile: 'user_profile',
  rentRecords: 'rent_records',
  paymentTransactions: 'payment_transactions',
  complaints: 'complaints',
  notifications: 'notifications',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          entity_id TEXT,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status);
        CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox (entity_id);

        CREATE TABLE IF NOT EXISTS sync_metadata (
          collection TEXT PRIMARY KEY NOT NULL,
          last_sync_at TEXT NOT NULL,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS tenant_profile (
          _id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_profile (
          _id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rent_records (
          _id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          month TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_rent_records_month ON rent_records (month);

        CREATE TABLE IF NOT EXISTS payment_transactions (
          _id TEXT PRIMARY KEY NOT NULL,
          rent_record_id TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_payment_transactions_rent_record ON payment_transactions (rent_record_id);

        CREATE TABLE IF NOT EXISTS complaints (
          _id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          _id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        PRAGMA user_version = ${SCHEMA_VERSION};
      `);
      return db;
    });
    dbPromise.catch((error) => {
      dbPromise = null;
      if (__DEV__) console.warn('[Db] Failed to open SQLite database', error);
    });
  }
  return dbPromise;
}

export function isDbSupported(): boolean {
  return Platform.OS !== 'web';
}
