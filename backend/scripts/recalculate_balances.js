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

    const records = await MonthlyRentRecord.find();
    console.log(`Found ${records.length} rent records. Recalculating...`);

    let fixedCount = 0;

    for (const record of records) {
      // Find all COMPLETED transactions for this record
      const validTxns = await PaymentTransaction.find({
        rentRecordId: record._id,
        status: 'completed'
      });

      const actualPaid = validTxns.reduce((sum, txn) => sum + txn.amount, 0);

      if (record.totalPaid !== actualPaid) {
        console.log(`Fixing Record ${record._id} (${record.month}): totalPaid was ${record.totalPaid}, should be ${actualPaid}`);
        record.totalPaid = actualPaid;
        await record.save(); // pre-save hook handles remainingAmount & status
        fixedCount++;
      }
    }

    console.log(`\n✅ Recalculation complete. Fixed ${fixedCount} records.`);
    process.exit(0);
  } catch (err) {
    console.error('Error during recalculation:', err);
    process.exit(1);
  }
}

run();
