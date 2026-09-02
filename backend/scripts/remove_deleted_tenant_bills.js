'use strict';

/**
 * remove_deleted_tenant_bills.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Finds and removes monthly rent records (and associated transactions/payments)
 * that were generated for:
 *   1. Tenants with status 'deleted' (or privacyDataPurged: true).
 *   2. Tenants with status 'vacated' or exitDate set, where the bill month is strictly AFTER their exit month.
 *   3. Orphaned rent records where tenantId no longer exists in Tenant collection.
 *
 * Usage:
 *   node scripts/remove_deleted_tenant_bills.js            # Dry run (shows what would be deleted)
 *   node scripts/remove_deleted_tenant_bills.js --confirm  # Permanently deletes records
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const Payment = require('../models/Payment');

async function run() {
  const args = process.argv.slice(2);
  const doExecute = args.includes('--confirm');

  if (args.includes('--help')) {
    console.log(`
  remove_deleted_tenant_bills.js

  Removes rent bills generated for deleted tenants or post-exit months.

    node scripts/remove_deleted_tenant_bills.js            → Dry run (report only)
    node scripts/remove_deleted_tenant_bills.js --confirm   → Permanently delete
`);
    process.exit(0);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rent-house';
  console.log(`🔌 Connecting to database...`);
  await mongoose.connect(mongoUri);
  console.log('✅ Connected.\n');

  console.log(doExecute ? '⚠️ EXECUTION MODE: Will permanently delete records.' : '🔍 DRY-RUN MODE: No changes will be saved to DB. (Pass --confirm to apply)\n');

  // 1. Fetch all tenants
  const allTenants = await Tenant.find({}).lean();
  const tenantMap = new Map();
  const deletedTenantIds = new Set();
  const exitMonthMap = new Map();

  for (const t of allTenants) {
    tenantMap.set(String(t._id), t);
    if (['deleted', 'pending_deletion'].includes(t.status) || t.privacyDataPurged) {
      deletedTenantIds.add(String(t._id));
    }
    if (t.exitDate) {
      const exitMonthStr = new Date(t.exitDate).toISOString().slice(0, 7);
      exitMonthMap.set(String(t._id), exitMonthStr);
    }
  }

  console.log(`📊 Found ${allTenants.length} total tenants (${deletedTenantIds.size} deleted/pending deletion).`);

  // 2. Fetch all MonthlyRentRecords
  const allRentRecords = await MonthlyRentRecord.find({}).lean();
  console.log(`📊 Found ${allRentRecords.length} total MonthlyRentRecords in DB.\n`);

  const rentRecordsToDelete = [];
  const deleteReasons = new Map();

  for (const record of allRentRecords) {
    const tidStr = String(record.tenantId);
    const tenant = tenantMap.get(tidStr);

    if (!tenant) {
      rentRecordsToDelete.push(record);
      deleteReasons.set(String(record._id), 'Orphaned (Tenant record does not exist)');
      continue;
    }

    if (deletedTenantIds.has(tidStr)) {
      rentRecordsToDelete.push(record);
      deleteReasons.set(String(record._id), `Tenant status is '${tenant.status}' / privacy purged`);
      continue;
    }

    const exitMonth = exitMonthMap.get(tidStr);
    if (exitMonth && record.month > exitMonth) {
      rentRecordsToDelete.push(record);
      deleteReasons.set(String(record._id), `Bill month (${record.month}) is after exit month (${exitMonth})`);
      continue;
    }
  }

  // 3. Fetch legacy Payments for deleted tenants / post-exit
  const allLegacyPayments = await Payment.find({}).lean();
  const legacyPaymentsToDelete = [];

  for (const p of allLegacyPayments) {
    const tidStr = String(p.tenantId);
    const tenant = tenantMap.get(tidStr);

    if (!tenant || deletedTenantIds.has(tidStr)) {
      legacyPaymentsToDelete.push(p);
      continue;
    }
    const exitMonth = exitMonthMap.get(tidStr);
    if (exitMonth && p.month > exitMonth) {
      legacyPaymentsToDelete.push(p);
      continue;
    }
  }

  console.log(`🔎 Scan Results:`);
  console.log(`   - MonthlyRentRecords to delete: ${rentRecordsToDelete.length}`);
  console.log(`   - Legacy Payments to delete:     ${legacyPaymentsToDelete.length}`);

  if (rentRecordsToDelete.length > 0) {
    console.log(`\n📋 Detail of MonthlyRentRecords flagged for removal:`);
    for (const r of rentRecordsToDelete) {
      const reason = deleteReasons.get(String(r._id));
      console.log(`   • ID: ${r._id} | Tenant: ${r.tenantId} | Month: ${r.month} | Amount: ₹${r.amount} | Reason: ${reason}`);
    }
  }

  if (doExecute) {
    if (rentRecordsToDelete.length > 0) {
      const recordIds = rentRecordsToDelete.map(r => r._id);
      
      // Delete linked PaymentTransactions
      const txRes = await PaymentTransaction.deleteMany({ rentRecordId: { $in: recordIds } });
      console.log(`\n🧹 Deleted ${txRes.deletedCount} linked PaymentTransactions.`);

      // Delete MonthlyRentRecords
      const recRes = await MonthlyRentRecord.deleteMany({ _id: { $in: recordIds } });
      console.log(`🧹 Deleted ${recRes.deletedCount} MonthlyRentRecords.`);
    }

    if (legacyPaymentsToDelete.length > 0) {
      const pIds = legacyPaymentsToDelete.map(p => p._id);
      const legRes = await Payment.deleteMany({ _id: { $in: pIds } });
      console.log(`🧹 Deleted ${legRes.deletedCount} legacy Payment records.`);
    }

    console.log('\n✨ Database cleanup complete.');
  } else {
    console.log('\n💡 DRY-RUN complete. Run with --confirm to perform actual deletion.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
