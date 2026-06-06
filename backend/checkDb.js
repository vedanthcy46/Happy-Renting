require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const MonthlyRentRecord = require('./models/MonthlyRentRecord');
    
    const missingFullRent = await MonthlyRentRecord.countDocuments({ $or: [{ fullRentAmount: { $exists: false } }, { fullRentAmount: null }] });
    const missingRentGen = await MonthlyRentRecord.countDocuments({ $or: [{ rentAmountAtGeneration: { $exists: false } }, { rentAmountAtGeneration: null }] });
    
    console.log('Missing/null fullRentAmount:', missingFullRent);
    console.log('Missing/null rentAmountAtGeneration:', missingRentGen);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
