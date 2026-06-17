const mongoose = require('mongoose');
require('dotenv').config({path: __dirname + '/../.env'});
const MonthlyRentRecord = require('../models/MonthlyRentRecord');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const records = await MonthlyRentRecord.find();
  let count = 0;
  for (const r of records) {
    const [y, m] = r.month.split('-');
    r.dueDate = new Date(y, Number(m) - 1, 5, 12, 0, 0, 0);
    await r.save();
    count++;
  }
  console.log('Updated ' + count + ' records.');
  process.exit(0);
});
