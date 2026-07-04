require('dotenv').config();
const mongoose = require('mongoose');
const PaymentTransaction = require('./models/PaymentTransaction');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const txs = await PaymentTransaction.find({ status: 'completed' }, 'paymentDate amount');
    console.log(`Total transactions: ${txs.length}`);
    let sum = 0;
    txs.forEach(tx => {
      console.log(`- Amount: ${tx.amount} on ${tx.paymentDate.toISOString()}`);
      sum += tx.amount;
    });
    console.log(`Total sum: ${sum}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
