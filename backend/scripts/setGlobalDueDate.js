'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });

const connectDB = require('../config/db');
const Tenant = require('../models/Tenant');
const logger = require('../config/logger');

const run = async () => {
  await connectDB();
  const GLOBAL_DUE_DAY = 5;

  try {
    logger.info('Starting migration to set global tenant due date to the 5th...');

    const result = await Tenant.updateMany(
      {}, // No filter, update all tenants
      {
        $set: {
          rentDueDay: GLOBAL_DUE_DAY,
          billingDay: GLOBAL_DUE_DAY,
          customBillingDay: GLOBAL_DUE_DAY,
        },
      }
    );

    logger.info(`Migration complete. Matched ${result.matchedCount} tenants, modified ${result.modifiedCount} tenants.`);
    logger.info('All tenants now have their due day set to the 5th of the month.');
  } catch (error) {
    logger.error('Error during tenant due date migration:', error);
  } finally {
    logger.info('Disconnecting from database.');
    process.exit(0);
  }
};

run();
