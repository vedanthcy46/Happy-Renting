'use strict';

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

async function runQuery() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Find the user/tenant "S R Arun Babu"
    const users = await User.find({ name: /Arun/i });
    console.log('Found Users matching "Arun":', users.map(u => ({ id: u._id, name: u.name, email: u.email })));

    for (const u of users) {
      const tenant = await Tenant.findOne({ userId: u._id });
      if (!tenant) {
        console.log(`User ${u.name} is not a tenant.`);
        continue;
      }
      console.log(`Tenant details: ID=${tenant._id} Rent=₹${tenant.rent}`);

      // Get rent records
      const rentRecords = await MonthlyRentRecord.find({ tenantId: tenant._id }).sort({ month: 1 });
      console.log(`Rent Records for ${u.name}:`);
      for (const rec of rentRecords) {
        console.log(`  - Record Month: ${rec.month} Rent: ₹${rec.totalRent} Paid: ₹${rec.totalPaid} Remaining: ₹${rec.remainingAmount} Status: ${rec.status}`);
        
        // Find transactions for this rent record
        const txns = await PaymentTransaction.find({ rentRecordId: rec._id }).sort({ createdAt: 1 });
        console.log(`    Transactions:`);
        for (const txn of txns) {
          console.log(`      * [${txn.status.toUpperCase()}] Date: ${txn.paymentDate.toISOString().split('T')[0]} Amount: ₹${txn.amount} Method: ${txn.paymentMethod} Type: ${txn.transactionType} Source: ${txn.entrySource}`);
        }
      }
    }
  } catch (err) {
    console.error('Error querying:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

runQuery();
