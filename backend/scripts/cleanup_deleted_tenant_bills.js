'use strict';

/**
 * cleanup_deleted_tenant_bills.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Removes MonthlyRentRecord entries (and linked PaymentTransactions) that were
 * generated for tenants whose status is 'deleted'.
 *
 * Usage:
 *   node scripts/cleanup_deleted_tenant_bills.js            # Dry run
 *   node scripts/cleanup_deleted_tenant_bills.js --confirm   # Execute
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');

async function run() {
  const args = process.argv.slice(2);
  const doExecute = args.includes('--confirm');

  if (args.includes('--help')) {
    console.log(`
cleanup_deleted_tenant_bills.js

Removes rent bills generated for tenants with status 'deleted'.

  node scripts/cleanup_deleted_tenant_bills.js            → Dry run
  node scripts/cleanup_deleted_tenant_bills.js --confirm   → Delete
`);
    process.exit(0);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rent-house';
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('Connected.\n');

  console.log(doExecute ? 'EXECUTION MODE: Records will be permanently deleted.' : 'DRY-RUN MODE: No changes will be saved. (Pass --confirm to apply)\n');

  const deletedTenants = await Tenant.find({ status: 'deleted' }).lean();
  const deletedIds = deletedTenants.map(t => t._id);

  if (deletedIds.length === 0) {
    console.log('No tenants with status "deleted" found. Nothing to do.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Found ${deletedIds.length} deleted tenant(s).`);

  const records = await MonthlyRentRecord.find({ tenantId: { $in: deletedIds } }).lean();
  console.log(`Found ${records.length} MonthlyRentRecord(s) for deleted tenants.\n`);

  if (records.length === 0) {
    console.log('No bills to remove.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const recordIds = records.map(r => r._id);
  const txCount = await PaymentTransaction.countDocuments({ rentRecordId: { $in: recordIds } });

  console.log('Records to be removed:');
  for (const r of records) {
    console.log(`  • ${r._id} | tenantId=${r.tenantId} | month=${r.month} | amount=${r.totalRent}`);
  }
  console.log(`\nLinked PaymentTransactions: ${txCount}`);

  if (doExecute) {
    const txRes = await PaymentTransaction.deleteMany({ rentRecordId: { $in: recordIds } });
    console.log(`Deleted ${txRes.deletedCount} PaymentTransaction(s).`);

    const recRes = await MonthlyRentRecord.deleteMany({ _id: { $in: recordIds } });
    console.log(`Deleted ${recRes.deletedCount} MonthlyRentRecord(s).`);
    console.log('\nCleanup complete.');
  } else {
    console.log('\nDry-run complete. Run with --confirm to delete.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
