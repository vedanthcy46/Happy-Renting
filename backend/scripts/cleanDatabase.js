'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const logger = require('../config/logger');

// Import all models
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Payment = require('../models/Payment');
const Complaint = require('../models/Complaint');
const OwnerRequest = require('../models/OwnerRequest');

const ActivityLog = require('../models/ActivityLog');

const cleanDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB for cleaning...');

    // Delete all data except superadmin users
    const deleteResults = await Promise.all([
      Tenant.deleteMany({}),
      Property.deleteMany({}),
      Room.deleteMany({}),
      Payment.deleteMany({}),
      Complaint.deleteMany({}),
      OwnerRequest.deleteMany({}),
      ActivityLog.deleteMany({}),
      User.deleteMany({ role: { $ne: 'superadmin' } })
    ]);

    logger.info('✅ All operational data cleared.');
    logger.info(`   Tenants: ${deleteResults[0].deletedCount}`);
    logger.info(`   Properties: ${deleteResults[1].deletedCount}`);
    logger.info(`   Rooms: ${deleteResults[2].deletedCount}`);
    logger.info(`   Payments: ${deleteResults[3].deletedCount}`);
    logger.info(`   Complaints: ${deleteResults[4].deletedCount}`);
    logger.info(`   OwnerRequests: ${deleteResults[5].deletedCount}`);
    logger.info(`   Activity Logs: ${deleteResults[6].deletedCount}`);
    logger.info(`   Non-Admin Users: ${deleteResults[7].deletedCount}`);

    // Check if at least one admin remains
    const adminCount = await User.countDocuments({ role: 'superadmin' });
    if (adminCount === 0) {
      logger.warn('⚠️ No Super Admin found! Your database is now empty. Please run the seed script to create an admin.');
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
