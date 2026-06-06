'use strict';

const cron         = require('node-cron');
const Payment      = require('../models/Payment');
const emailService = require('../services/emailService');
const logger       = require('../config/logger');

/**
 * cronJobs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled tasks for rent tracking and automated notifications.
 */

const billingServiceV2 = require('../services/billingServiceV2');
const backupService = require('../services/backupService');

const startCronJobs = () => {
  // Run every day at 01:00 AM IST (Asia/Kolkata)
  cron.schedule('0 1 * * *', async () => {
    logger.info('[CRON] Starting daily rent status check (IST timezone)...');
    
    try {
      const today    = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // ───────────────────────────────────────────────────────────────────────
      // V1 SYSTEM (Legacy)
      // ───────────────────────────────────────────────────────────────────────
      // 1. Check for Pre-Due Reminders (Due Tomorrow)
      const pendingReminders = await Payment.find({
        status: { $nin: ['paid', 'processing'] },
        dueDate: { 
          $gte: tomorrow, 
          $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) 
        },
        reminderSent: false
      }).populate('userId ownerId propertyId roomId');

      for (const p of pendingReminders) {
        await emailService.sendRentDueReminder(p.userId, p, p.propertyId, p.roomId, p.ownerId);
        p.reminderSent = true;
        await p.save();
      }

      // 2. Check for Overdue Payments
      const overduePayments = await Payment.find({
        status: { $nin: ['paid', 'processing', 'overdue'] },
        dueDate: { $lt: today }
      }).populate('userId ownerId propertyId roomId');

      for (const p of overduePayments) {
        p.status = 'overdue';
        await p.save();
        await emailService.sendOverdueAlert(p.userId, p, p.propertyId, p.roomId, p.ownerId);
        logger.info(`[CRON-V1] Payment ${p._id} marked as OVERDUE`);
      }

      // ───────────────────────────────────────────────────────────────────────
      // V2 SYSTEM (Ledger-based)
      // ───────────────────────────────────────────────────────────────────────
      try {
        logger.info('[CRON-V2] Generating V2 Monthly Rent Records...');
        await billingServiceV2.generateMonthlyBills(); // Globally for all owners
      } catch (err) {
        logger.error(`[CRON ERROR] generateMonthlyBills failed: ${err.message}`);
      }

      try {
        logger.info('[CRON-V2] Updating V2 Overdue Statuses...');
        await billingServiceV2.updateOverduePayments(); // Globally
      } catch (err) {
        logger.error(`[CRON ERROR] updateOverduePayments failed: ${err.message}`);
      }

      try {
        logger.info('[CRON-V2] Purging Privacy Data for vacated tenants...');
        await billingServiceV2.purgePrivacyData();
      } catch (err) {
        logger.error(`[CRON ERROR] purgePrivacyData failed: ${err.message}`);
      }

      logger.info(`[CRON] Daily check completed successfully.`);
    } catch (err) {
      logger.error(`[CRON ERROR] ${err.message}`);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata' // Timezone safety for Indian real estate
  });

  logger.info('[CRON] Scheduled jobs initialized (Timezone: Asia/Kolkata).');

  // Background Notification Queue (Every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    try {
      await emailService.processNotificationQueue();
    } catch (err) {
      logger.error(`[CRON QUEUE ERROR] ${err.message}`);
    }
  });
  logger.info('[CRON] Notification queue processor initialized (Every 5 mins).');

  // Secure Database Backup (Every Sunday at 3:00 AM)
  cron.schedule('0 3 * * 0', () => {
    logger.info('[CRON] Starting weekly encrypted database backup...');
    backupService.runEncryptedBackup();
  });
};

module.exports = { startCronJobs };
