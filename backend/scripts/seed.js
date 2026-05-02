'use strict';

/**
 * Seed Script — creates a default Super Admin account.
 *
 * Run: node scripts/seed.js
 *
 * ⚠️  Change the admin password immediately after first login!
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User     = require('../models/User');
const logger   = require('../config/logger');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB for seeding.');

    const email    = process.env.SEED_ADMIN_EMAIL    || 'vedanthh46@gmail.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'Vedanth7274@';

    const existing = await User.findOne({ email });
    if (existing) {
      logger.warn(`Admin already exists: ${email}. Skipping seed.`);
      await mongoose.disconnect();
      return;
    }

    const admin = await User.create({
      name    : 'Super Admin',
      email,
      password,
      role    : 'superadmin',
      isActive: true,
    });

    logger.info(`✅  Super Admin created!`);
    logger.info(`    Email   : ${admin.email}`);
    logger.info(`    Password: ${password}`);
    logger.info(`    ⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error(`Seed failed: ${err.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
