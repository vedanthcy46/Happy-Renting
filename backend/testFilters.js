const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/rent-house-v2', { retryWrites: false }).then(async () => {
  const M = require('./models/MonthlyRentRecord');
  const c1 = await M.countDocuments({ month: { $regex: '-05$' } });
  const c2 = await M.countDocuments({ month: { $regex: '^2026-' } });
  console.log('month-only (-05$):', c1);
  console.log('year-only (^2026-):', c2);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
