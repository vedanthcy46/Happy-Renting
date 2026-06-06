require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rent_house');
const MonthlyRentRecord = require('./models/MonthlyRentRecord');
const PaymentTransaction = require('./models/PaymentTransaction');

async function fixTotalPaid() {
  const records = await MonthlyRentRecord.find();
  let fixed = 0;
  for (let record of records) {
    const txns = await PaymentTransaction.find({ rentRecordId: record._id, status: 'completed' });
    const correctTotal = txns.reduce((sum, t) => sum + t.amount, 0);
    if (record.totalPaid !== correctTotal) {
      console.log(`Fixing record ${record._id}: totalPaid=${record.totalPaid}, correct=${correctTotal}`);
      record.totalPaid = correctTotal;
      record.advanceBalance = Math.max(0, correctTotal - record.totalRent);
      await record.save();
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} records.`);
  process.exit();
}
fixTotalPaid();
