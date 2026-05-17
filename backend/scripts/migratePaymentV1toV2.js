'use strict';

/**
 * migratePaymentV1toV2.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script to migrate Payment (V1) records to MonthlyRentRecord (V2)
 * 
 * Usage:
 *   node scripts/migratePaymentV1toV2.js
 * 
 * What it does:
 *   1. For each Payment record:
 *      - Create MonthlyRentRecord with same month and tenant
 *      - Create PaymentTransaction for the payment
 *   2. Handles deduplication (skips if record already exists)
 *   3. Logs all actions
 * 
 * IMPORTANT:
 *   - Run this only once
 *   - Backup database before running
 *   - Review test run output first
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const logger = require('../config/logger');

const connectDB = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────
// MIGRATION LOGIC
// ─────────────────────────────────────────────────────────────────────────

const migratePayment = async (payment, options = {}) => {
  try {
    const { dryRun = false, verbose = false } = options;

    if (verbose) {
      console.log(`\n[MIGRATE] Payment ID: ${payment._id}`);
      console.log(`  Tenant: ${payment.tenantId}`);
      console.log(`  Month: ${payment.month}`);
      console.log(`  Amount: ${payment.amount}`);
      console.log(`  Status: ${payment.status}`);
    }

    // 1. Check if rent record already exists
    let rentRecord = await MonthlyRentRecord.findOne({
      tenantId: payment.tenantId,
      month: payment.month,
    });

    if (rentRecord) {
      if (verbose) console.log(`  → Rent record already exists, skipping`);
      return { status: 'skipped', reason: 'rentRecordExists' };
    }

    if (dryRun) {
      if (verbose) console.log(`  → [DRY RUN] Would create rent record`);
      return { status: 'dryRun' };
    }

    // 2. Create MonthlyRentRecord
    rentRecord = await MonthlyRentRecord.create({
      tenantId: payment.tenantId,
      userId: payment.userId,
      roomId: payment.roomId,
      propertyId: payment.propertyId,
      ownerId: payment.ownerId,
      month: payment.month,
      totalRent: payment.amount,
      totalPaid: payment.status === 'paid' || payment.status === 'partial' 
        ? payment.amount 
        : 0,
      dueDate: payment.dueDate,
      notes: `Migrated from V1 Payment. Original status: ${payment.status}`,
    });

    if (verbose) console.log(`  ✓ Created rent record: ${rentRecord._id}`);

    // 3. If payment was paid/partial, create transaction
    if (payment.status === 'paid' || payment.status === 'partial') {
      const transaction = await PaymentTransaction.create({
        rentRecordId: rentRecord._id,
        tenantId: payment.tenantId,
        ownerId: payment.ownerId,
        propertyId: payment.propertyId,
        amount: payment.amount,
        paymentMethod: payment.method || 'other',
        transactionId: payment.transactionId || null,
        paymentDate: payment.paidDate || payment.createdAt,
        note: payment.notes ? `[V1] ${payment.notes}` : 'Migrated from V1 Payment',
        proofImage: payment.proofImage || { secureUrl: null, publicId: null },
        recordedBy: payment.recordedBy,
        status: 'completed',
      });

      if (verbose) console.log(`  ✓ Created transaction: ${transaction._id}`);
    }

    return { status: 'migrated', rentRecordId: rentRecord._id };
  } catch (err) {
    logger.error(`[MIGRATION ERROR] Payment ${payment._id}: ${err.message}`);
    return { status: 'error', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────────────────

const main = async () => {
  try {
    await connectDB();
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Payment System Migration (V1 → V2)            ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    // Parse CLI arguments
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isVerbose = args.includes('--verbose');

    if (isDryRun) {
      console.log('⚠️  DRY RUN MODE - No data will be modified\n');
    }

    // 1. Count existing payments
    const paymentCount = await Payment.countDocuments();
    console.log(`Total V1 Payments found: ${paymentCount}\n`);

    if (paymentCount === 0) {
      console.log('No payments to migrate. Exiting.');
      process.exit(0);
    }

    // 2. Get all payments
    const payments = await Payment.find().sort({ createdAt: 1 });

    // 3. Migrate each
    const results = {
      migrated: 0,
      skipped: 0,
      errors: 0,
      dryRun: 0,
    };

    for (const payment of payments) {
      const result = await migratePayment(payment, { dryRun: isDryRun, verbose: isVerbose });

      if (result.status === 'migrated') results.migrated++;
      else if (result.status === 'skipped') results.skipped++;
      else if (result.status === 'error') results.errors++;
      else if (result.status === 'dryRun') results.dryRun++;
    }

    // 4. Summary
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Migration Summary                              ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    if (isDryRun) {
      console.log(`Dry run results:`);
      console.log(`  Would migrate: ${results.dryRun}`);
      console.log(`  Would skip: ${results.skipped}`);
      console.log(`  Errors: ${results.errors}`);
      console.log(`\nRe-run without --dry-run to actually migrate`);
    } else {
      console.log(`✓ Migrated: ${results.migrated}`);
      console.log(`→ Skipped (already v2): ${results.skipped}`);
      console.log(`✗ Errors: ${results.errors}`);

      if (results.migrated > 0) {
        console.log(`\n✓ Migration complete! ${results.migrated} payments converted.`);
        console.log('  V1 Payment records remain unchanged.');
        console.log('  You can safely use V2 endpoints now.');
        console.log('  Optionally archive or delete V1 Payment records later.');
      }
    }

    process.exit(0);
  } catch (err) {
    logger.error(`[MIGRATION FAILED] ${err.message}`);
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migratePayment };
