'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Models
const Payment = require('../models/Payment');
const PaymentTransaction = require('../models/PaymentTransaction');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const LedgerAuditLog = require('../models/LedgerAuditLog');
const LedgerJob = require('../models/LedgerJob');
const Tenant = require('../models/Tenant');

async function run() {
  const args = process.argv.slice(2);
  
  if (!args.includes('--confirm')) {
    console.log('\n❌ WARNING: This script will DELETE ALL financial records from the database!');
    console.log('This includes:');
    console.log(' - All V1 Legacy Payments');
    console.log(' - All V2 Payment Transactions');
    console.log(' - All V2 Monthly Rent Records');
    console.log(' - All Ledger Audit Logs');
    console.log(' - All Pending Ledger Jobs');
    console.log('\nTo proceed, you must run the script with the --confirm flag:');
    console.log('👉 node scripts/wipe_ledger.js --confirm\n');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB successfully.\n');

    console.log('🧹 Wiping Payment (V1) collection...');
    const paymentResult = await Payment.deleteMany({});
    console.log(`   Deleted ${paymentResult.deletedCount} V1 payments.`);

    console.log('🧹 Wiping PaymentTransaction (V2) collection...');
    const transactionResult = await PaymentTransaction.deleteMany({});
    console.log(`   Deleted ${transactionResult.deletedCount} V2 transactions.`);

    console.log('🧹 Wiping MonthlyRentRecord (V2) collection...');
    const monthlyResult = await MonthlyRentRecord.deleteMany({});
    console.log(`   Deleted ${monthlyResult.deletedCount} monthly rent records.`);

    console.log('🧹 Wiping LedgerAuditLog collection...');
    const auditResult = await LedgerAuditLog.deleteMany({});
    console.log(`   Deleted ${auditResult.deletedCount} audit logs.`);

    console.log('🧹 Wiping LedgerJob collection...');
    const jobResult = await LedgerJob.deleteMany({});
    console.log(`   Deleted ${jobResult.deletedCount} ledger jobs.`);

    console.log('\n✅ All financial transaction records have been successfully deleted.');
    
    // Suggest next steps
    console.log('\nNote: The cron job will automatically generate fresh MonthlyRentRecords for all active tenants tonight.');
    console.log('If you want to generate them immediately, you can trigger a rent calculation.');
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error during wipe operation:', err);
    process.exit(1);
  }
}

run();
