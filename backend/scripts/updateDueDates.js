const mongoose = require('mongoose');
require('dotenv').config({path: __dirname + '/../.env'});
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const { calculateDueDate } = require('../utils/billingCalculationService');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const records = await MonthlyRentRecord.find();
  let count = 0;
  for (const r of records) {
    // Postpaid model: a bill for occupancy month M is due on the 5th of M+1.
    const [y, m] = r.month.split('-');
    const nextYearMonth = new Date(Number(y), Number(m), 1); // 1st of M+1
    const dueMonthStr = `${nextYearMonth.getFullYear()}-${String(nextYearMonth.getMonth() + 1).padStart(2, '0')}`;
    r.dueDate = calculateDueDate(dueMonthStr);
    await r.save();
    count++;
  }
  console.log('Updated ' + count + ' records.');
  process.exit(0);
});
