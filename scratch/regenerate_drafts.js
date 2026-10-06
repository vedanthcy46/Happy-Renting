const mongoose = require('mongoose');
const { MonthlyBill } = require('./backend/models/MonthlyBill'); // check path
const { generateMonthlyBills } = require('./backend/services/billingServiceV2');

const run = async () => {
  const MonthlyBillModel = require('./backend/models/MonthlyBill');
  require('dotenv').config({ path: './backend/.env' });
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  const result = await MonthlyBillModel.deleteMany({ status: 'DRAFT' });
  console.log(`Deleted ${result.deletedCount} drafts`);

  console.log("Running cron to regenerate...");
  const stats = await generateMonthlyBills();
  console.log("Cron finished.", stats);
  
  process.exit(0);
};
run();
