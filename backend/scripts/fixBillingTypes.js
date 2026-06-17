const mongoose = require('mongoose');
require('dotenv').config({path: __dirname + '/../.env'});
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const Tenant = require('../models/Tenant');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const records = await MonthlyRentRecord.find({billingType: 'prorated_join'});
  let count = 0;
  for (const r of records) {
    const t = await Tenant.findById(r.tenantId);
    if (t && t.exitDate) {
      const exitMonthStr = t.exitDate.toISOString().slice(0,7);
      if (exitMonthStr === r.month) {
        r.billingType = 'prorated_moveout';
        await r.save();
        count++;
      }
    }
  }
  console.log('Fixed ' + count + ' records.');
  process.exit(0);
});
