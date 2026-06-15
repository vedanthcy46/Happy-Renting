'use strict';

const mongoose = require('mongoose');
const MonthlyRentRecord = require('./backend/models/MonthlyRentRecord');
const logger = require('./backend/config/logger');

async function cleanupJuneBills() {
  try {
    // Load environment variables if not already loaded
    require('dotenv').config({ path: './.env' });
    
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI not found in .env file.');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const targetMonth = '2026-06';
    
    // Safety check: only delete 'pending' bills with zero payments
    const query = {
        month: targetMonth,
        status: 'pending',
        totalPaid: 0
    };

    const count = await MonthlyRentRecord.countDocuments(query);
    console.log(`Found ${count} pending bills for ${targetMonth} with no payments.`);

    if (count > 0) {
        const result = await MonthlyRentRecord.deleteMany(query);
        console.log(`Successfully deleted ${result.deletedCount} bills.`);
    } else {
        console.log('No bills found to delete.');
    }

    await mongoose.connection.close();
    console.log('Done.');
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanupJuneBills();
