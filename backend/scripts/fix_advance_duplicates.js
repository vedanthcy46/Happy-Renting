'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB successfully.\n');

    // 1. Delete all system-generated 'advance_applied' and 'advance_deducted' transactions
    console.log('🧹 Deleting all system-generated advance transactions to start fresh...');
    const delResult = await PaymentTransaction.deleteMany({
      transactionType: { $in: ['advance_applied', 'advance_deducted'] },
      entrySource: { $in: ['auto_adjustment', 'system_generated'] }
    });
    console.log(`   Deleted ${delResult.deletedCount} advance system transactions.`);

    // 2. Recalculate pure 'totalPaid' for ALL records based only on real manual transactions
    const records = await MonthlyRentRecord.find().sort({ tenantId: 1, month: 1 });
    console.log(`\n🔄 Recalculating pure manual balances for ${records.length} rent records...`);
    
    // Group records by tenant
    const tenantGroups = {};
    for (const record of records) {
      if (!tenantGroups[record.tenantId]) tenantGroups[record.tenantId] = [];
      tenantGroups[record.tenantId].push(record);
      
      const realTxns = await PaymentTransaction.find({
        rentRecordId: record._id,
        status: 'completed' // only completed real txns remain
      });
      
      const realPaid = realTxns.reduce((sum, txn) => sum + txn.amount, 0);
      record.totalPaid = realPaid;
      await record.save(); // let pre-save hook calculate raw advanceBalance and remainingAmount
    }

    // 3. Re-apply advance balances chronologically using the fixed logic
    console.log(`\n⚖️ Re-applying advance balances safely...`);
    const { applyAdvanceBalance } = require('../services/paymentServiceV2');
    
    for (const tenantId in tenantGroups) {
      // paymentServiceV2's applyAdvanceBalance will recalculate across the tenant's timeline
      // and properly insert BOTH advance_applied and advance_deducted transactions.
      await applyAdvanceBalance(tenantId);
    }

    console.log('\n✅ Advance application duplication fully resolved!');
    process.exit(0);
  } catch (err) {
    console.error('Error during advance fix:', err);
    process.exit(1);
  }
}

run();
