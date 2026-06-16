require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PaymentTransaction = require('../models/PaymentTransaction');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const LedgerAuditLog = require('../models/LedgerAuditLog');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const records = await MonthlyRentRecord.find().sort({ tenantId: 1, month: 1 }).lean();
  const rGroups = {};
  for (const r of records) {
    const key = `${r.tenantId}_${r.month}`;
    if (!rGroups[key]) rGroups[key] = [];
    rGroups[key].push(r);
  }

  const rDuplicates = [];
  for (const key in rGroups) {
    if (rGroups[key].length > 1) {
      rDuplicates.push(rGroups[key]);
    }
  }

  console.log(`Found ${rDuplicates.length} duplicate MonthlyRentRecords.`);
  rDuplicates.forEach(group => {
    console.log(`\nDuplicate Rent Records for ${group[0].month} (Tenant: ${group[0].tenantId}):`);
    group.forEach(g => {
       console.log(`  ID=${g._id}, Rent=${g.totalRent}, Paid=${g.totalPaid}, Status=${g.status}`);
    });
  });

  // Also print all PaymentTransactions for the tenant that the user was talking about: 'arunbabusrarun@gmail.com' or 'rrathna536@gmail.com'. Wait, the user was just looking at email logs.
  // The email was for 'Payment Recorded for 2026-05'.
  // Let's just find any transactions in the database that are duplicates (by amount, method, tenant) without the 60 second constraint.
  const txns = await PaymentTransaction.find().sort({ tenantId: 1, createdAt: 1 }).lean();
  const txGroups = {};
  for (const t of txns) {
    const key = `${t.tenantId}_${t.rentRecordId}_${t.amount}_${t.paymentMethod}`;
    if (!txGroups[key]) txGroups[key] = [];
    txGroups[key].push(t);
  }

  const txDuplicates = [];
  for (const key in txGroups) {
    if (txGroups[key].length > 1) {
      txDuplicates.push(txGroups[key]);
    }
  }
  
  console.log(`\nFound ${txDuplicates.length} transactions with same tenant, record, amount, and method.`);
  txDuplicates.forEach((group, idx) => {
    console.log(`\nTransaction Group ${idx + 1}:`);
    group.forEach(t => console.log(`  ID=${t._id}, Amount=${t.amount}, CreatedAt=${t.createdAt}`));
  });

  process.exit(0);
}

run().catch(console.error);
