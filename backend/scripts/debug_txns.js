'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');
  
  const records = await MonthlyRentRecord.find().sort({ tenantId: 1, month: 1 });
  for (const r of records) {
    const txns = await PaymentTransaction.find({ rentRecordId: r._id }).sort({ createdAt: 1 });
    console.log(`\nMonth: ${r.month} | Rent: ${r.totalRent} | Paid: ${r.totalPaid} | Advance: ${r.advanceBalance} | Remaining: ${r.remainingAmount}`);
    for (const t of txns) {
      console.log(`  - Txn: ₹${t.amount} | Type: ${t.transactionType} | Status: ${t.status} | Source: ${t.entrySource}`);
    }
  }
  process.exit(0);
}
run();
