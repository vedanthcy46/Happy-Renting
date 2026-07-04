require('dotenv').config();
const mongoose = require('mongoose');
const PaymentTransaction = require('./models/PaymentTransaction');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const tDate = new Date(undefined);
    console.log('tDate:', tDate);
    
    const startOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
    const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);
    
    console.log('startOfDay:', startOfDay);
    console.log('endOfDay:', endOfDay);

    const agg = await PaymentTransaction.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: startOfDay, $lt: endOfDay } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } }
    ]);
    console.log('Agg with Invalid Date:', agg);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
