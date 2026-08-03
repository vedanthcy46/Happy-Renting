'use strict';

/**
 * cleanup_orphaned_ledger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deletes payment ledger records (V2 rent records + transactions, V1 payments)
 * that reference users/tenants which no longer exist. These "orphans" appear
 * in the Rent Ledger even after the user was deleted from User Management,
 * because earlier deletions did not always purge the ledger rows.
 *
 * Usage:
 *   node scripts/cleanup_orphaned_ledger.js            # dry run (report only)
 *   node scripts/cleanup_orphaned_ledger.js --confirm  # actually delete
 *   node scripts/cleanup_orphaned_ledger.js --help
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const PaymentTransaction = require('../models/PaymentTransaction');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');

async function run() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
  cleanup_orphaned_ledger.js

  Deletes payment ledger records whose owner/tenant references no longer exist.

    node scripts/cleanup_orphaned_ledger.js            → dry run (report only)
    node scripts/cleanup_orphaned_ledger.js --confirm   → permanently delete
`);
    process.exit(0);
  }

  const confirm = args.includes('--confirm');

  if (!confirm) {
    console.log('\n⚠️  DRY RUN - no changes will be made.');
    console.log('Run with --confirm to actually delete orphaned records.\n');
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB successfully.\n');

    const existingUserIds = (await User.find({}, { _id: 1 })).map(u => u._id);
    const existingOwnerIds = (await User.find({ role: 'owner' }, { _id: 1 })).map(u => u._id);
    const existingTenantIds = (await Tenant.find({}, { _id: 1 })).map(t => t._id);

    console.log(`Reference sets built: users=${existingUserIds.length}, owners=${existingOwnerIds.length}, tenants=${existingTenantIds.length}\n`);

    // A ledger row is orphaned when its owner is gone OR its tenant is gone.
    const orphanFilter = {
      $or: [
        { ownerId: { $nin: existingOwnerIds } },
        { tenantId: { $nin: existingTenantIds } },
      ],
    };

    const tasks = [
      {
        name: 'MonthlyRentRecord (V2 ledger)',
        model: MonthlyRentRecord,
        filter: orphanFilter,
      },
      {
        name: 'PaymentTransaction (V2 transactions)',
        model: PaymentTransaction,
        filter: orphanFilter,
      },
      {
        name: 'Payment (V1 legacy)',
        model: Payment,
        filter: {
          $or: [
            { ownerId: { $nin: existingUserIds } },
            { tenantId: { $nin: existingTenantIds } },
            { userId: { $nin: existingUserIds } },
          ],
        },
      },
    ];

    let totalOrphans = 0;
    for (const task of tasks) {
      const matches = await task.model.countDocuments(task.filter);
      totalOrphans += matches;

      if (matches > 0) {
        console.log(`🧹 ${task.name}: ${matches} orphaned record(s) found.`);
        if (confirm) {
          const { deletedCount } = await task.model.deleteMany(task.filter);
          console.log(`   → Deleted ${deletedCount} record(s).`);
        } else {
          console.log('   → Skipped (dry run).');
        }
      } else {
        console.log(`✅ ${task.name}: 0 orphaned records.`);
      }
    }

    console.log(`\n${confirm ? '✅ Cleanup complete.' : '⚠️  Dry run complete.'} Total orphans detected: ${totalOrphans}`);
    console.log(confirm
      ? 'The Rent Ledger will no longer show records from deleted users.'
      : 'Re-run with --confirm to remove them.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error during cleanup:', err);
    process.exit(1);
  }
}

run();
