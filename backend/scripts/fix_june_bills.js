require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const Notification = require('../models/Notification');

const fixJuneBills = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    // 1. Find all incorrectly generated June bills
    // We only want to delete bills for 2026-06 that have 0 paid (to be safe)
    const badBills = await MonthlyRentRecord.find({
      month: '2026-06',
      totalPaid: 0,
      status: { $in: ['pending', 'overdue'] }
    });

    console.log(`Found ${badBills.length} unpaid 2026-06 bills to clean up.`);

    if (badBills.length > 0) {
      const badBillIds = badBills.map(b => b._id);
      
      // 2. Delete the associated notifications that were generated for these bills
      const deletedNotifs = await Notification.deleteMany({
        'data.rentRecordId': { $in: badBillIds }
      });
      console.log(`Deleted ${deletedNotifs.deletedCount} related notifications.`);

      // 3. Delete the bills themselves
      const deletedBills = await MonthlyRentRecord.deleteMany({
        _id: { $in: badBillIds }
      });
      console.log(`Deleted ${deletedBills.deletedCount} monthly rent records.`);
    }

    console.log('\nCleanup complete! The cron job will safely regenerate the 2026-06 bills tonight with the correct July 5th due date.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
};

fixJuneBills();
