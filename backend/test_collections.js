require('dotenv').config();
const mongoose = require('mongoose');
const PaymentTransaction = require('./models/PaymentTransaction');
const reportingService = require('./services/reportingService');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Admin today collections:
    const tDate = new Date('2026-07-01');
    const startOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
    const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);
    console.log('startOfDay:', startOfDay);
    console.log('endOfDay:', endOfDay);

    const agg = await PaymentTransaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } }
    ]);
    console.log('Total ALL TIME platform collections:', agg);

    const aggToday = await PaymentTransaction.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: startOfDay, $lt: endOfDay } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } }
    ]);
    console.log('Total TODAY platform collections:', aggToday);

    const aggMonth = await PaymentTransaction.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: new Date(tDate.getFullYear(), tDate.getMonth(), 1), $lt: endOfDay } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } }
    ]);
    console.log('Total THIS MONTH platform collections:', aggMonth);

    // Let's also check sample documents:
    const sample = await PaymentTransaction.findOne({ status: 'completed' }, 'paymentDate createdAt amount');
    console.log('Sample paymentDate:', sample?.paymentDate);
    console.log('Sample createdAt:', sample?.createdAt);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
