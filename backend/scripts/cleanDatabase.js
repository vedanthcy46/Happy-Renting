'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../config/logger');

// Import all models
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Payment = require('../models/Payment');
const Complaint = require('../models/Complaint');
const ActivityLog = require('../models/ActivityLog');

const cleanDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB for cleaning...');

    // Delete all data except superadmin users
    // We keep users with role 'superadmin' to avoid locking the user out
    const deleteResults = await Promise.all([
      Tenant.deleteMany({}),
      Property.deleteMany({}),
      Room.deleteMany({}),
      Payment.deleteMany({}),
      Complaint.deleteMany({}),
      ActivityLog.deleteMany({}),
      User.deleteMany({})
    ]);

    logger.info('✅ All operational data cleared.');
    logger.info(`   Tenants: ${deleteResults[0].deletedCount}`);
    logger.info(`   Properties: ${deleteResults[1].deletedCount}`);
    logger.info(`   Rooms: ${deleteResults[2].deletedCount}`);
    logger.info(`   Payments: ${deleteResults[3].deletedCount}`);
    logger.info(`   Complaints: ${deleteResults[4].deletedCount}`);
    logger.info(`   ActivityLogs: ${deleteResults[5].deletedCount}`);
    logger.info(`   Non-Admin Users: ${deleteResults[6].deletedCount}`);

    // Check if at least one admin remains, if not, we should probably seed one
    const adminCount = await User.countDocuments({ role: 'superadmin' });
    if (adminCount === 0) {
      logger.warn('No Super Admin found! Please run the seed script.');
    } else {
      logger.info(`✅ ${adminCount} Super Admin(s) preserved.`);
    }

    await mongoose.disconnect();
    logger.info('Database connection closed.');
  } catch (err) {
    logger.error(`Cleanup failed: ${err.message}`);
    process.exit(1);
  }
};

cleanDatabase();
