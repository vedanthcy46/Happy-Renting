'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PaymentTransaction = require('../models/PaymentTransaction');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const billingServiceV2 = require('../services/billingServiceV2');
const logger = require('../config/logger');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    // 1. Find Duplicate Payment Transactions
    console.log('\n--- Scanning for duplicate PaymentTransactions ---');
    const txns = await PaymentTransaction.find().sort({ tenantId: 1, createdAt: 1 }).lean();
    
    let deletedTxnsCount = 0;
    const affectedRentRecordIds = new Set();
    const processedTxnIds = new Set(); // to avoid deleting the same thing multiple times in loop

    for (let i = 0; i < txns.length - 1; i++) {
      const current = txns[i];
      const next = txns[i + 1];

      if (processedTxnIds.has(current._id.toString())) continue;

      // Duplicate condition: Same tenant, same rentRecord, same amount, created within 60 seconds
      if (
        current.tenantId.toString() === next.tenantId.toString() &&
        current.rentRecordId.toString() === next.rentRecordId.toString() &&
        current.amount === next.amount &&
        Math.abs(new Date(current.createdAt) - new Date(next.createdAt)) < 60000 &&
        !processedTxnIds.has(next._id.toString())
      ) {
        console.log(`Found Duplicate Transaction! Keeping ${current._id}, Deleting ${next._id}`);
        console.log(`  Amount: ₹${current.amount}, TimeDiff: ${Math.abs(new Date(current.createdAt) - new Date(next.createdAt))}ms`);
        
        // Delete the duplicate (next)
        await PaymentTransaction.findByIdAndDelete(next._id);
        deletedTxnsCount++;
        processedTxnIds.add(next._id.toString());
        affectedRentRecordIds.add(current.rentRecordId.toString());
      }
    }
    console.log(`Deleted ${deletedTxnsCount} duplicate transactions.`);

    // 2. Find Duplicate MonthlyRentRecords
    console.log('\n--- Scanning for duplicate MonthlyRentRecords ---');
    const records = await MonthlyRentRecord.find().sort({ tenantId: 1, month: 1, createdAt: 1 }).lean();
    
    let deletedRecordsCount = 0;
    const processedRecordIds = new Set();

    for (let i = 0; i < records.length - 1; i++) {
      const current = records[i];
      const next = records[i + 1];

      if (processedRecordIds.has(current._id.toString())) continue;

      // Duplicate condition: Same tenant, same month
      if (
        current.tenantId.toString() === next.tenantId.toString() &&
        current.month === next.month &&
        !processedRecordIds.has(next._id.toString())
      ) {
        // Decide which one to keep. The one with transactions is better.
        const currentTxnsCount = await PaymentTransaction.countDocuments({ rentRecordId: current._id });
        const nextTxnsCount = await PaymentTransaction.countDocuments({ rentRecordId: next._id });

        let toKeep = current;
        let toDelete = next;

        if (nextTxnsCount > currentTxnsCount) {
          toKeep = next;
          toDelete = current;
        }

        console.log(`Found Duplicate Rent Record! Tenant: ${current.tenantId}, Month: ${current.month}`);
        console.log(`  Keeping ${toKeep._id} (${Math.max(currentTxnsCount, nextTxnsCount)} txns)`);
        console.log(`  Deleting ${toDelete._id} (${Math.min(currentTxnsCount, nextTxnsCount)} txns)`);
        
        await MonthlyRentRecord.findByIdAndDelete(toDelete._id);
        deletedRecordsCount++;
        processedRecordIds.add(toDelete._id.toString());
      }
    }
    console.log(`Deleted ${deletedRecordsCount} duplicate rent records.`);

    // 3. Recalculate totals for affected rent records
    console.log('\n--- Recalculating Totals for Affected Rent Records ---');
    for (const recordId of affectedRentRecordIds) {
      const record = await MonthlyRentRecord.findById(recordId);
      if (!record) continue;

      // Calculate total paid from all remaining valid transactions
      const validTxns = await PaymentTransaction.find({ 
        rentRecordId: recordId, 
        status: { $in: ['completed', 'verifying'] } 
      });
      
      const newTotalPaid = validTxns.reduce((sum, txn) => sum + txn.amount, 0);
      
      console.log(`Recalculating Record ${recordId}: Old Paid = ₹${record.totalPaid}, New Paid = ₹${newTotalPaid}`);
      
      record.totalPaid = newTotalPaid;
      // Pre-save hook in MonthlyRentRecord will automatically recalculate remainingAmount, advanceBalance, and status
      await record.save();
    }

    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

run();
