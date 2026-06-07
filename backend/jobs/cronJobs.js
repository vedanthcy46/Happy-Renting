'use strict';

const cron         = require('node-cron');
const Payment      = require('../models/Payment');
const emailService = require('../services/emailService');
const logger       = require('../config/logger');
const NotificationQueue = require('../models/NotificationQueue');
const LedgerJob = require('../models/LedgerJob');

/**
 * cronJobs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled tasks for rent tracking and automated notifications.
 */

const billingServiceV2 = require('../services/billingServiceV2');
const backupService = require('../services/backupService');
const ledgerQueueService = require('../services/ledgerQueueService');

const runDailyJobs = async () => {
  logger.info('[CRON] Starting daily rent status check (IST timezone)...');
  
  try {
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
const startCronJobs = () => {
  // Run every day at 10:10 AM IST (Asia/Kolkata)
  cron.schedule('10 10 * * *', async () => {
    logger.info('[CRON] Starting daily rent status check (IST timezone)...');
    
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
};

const startCronJobs = () => {
  // Run every day at 01:00 AM IST (Asia/Kolkata)
  cron.schedule('0 1 * * *', async () => {
    await runDailyJobs();
    

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

  // Ledger Job Watchdog (Every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    try {
      await ledgerQueueService.runWatchdog();
    } catch (err) {
      logger.error(`[CRON LEDGER WATCHDOG ERROR] ${err.message}`);
    }
  });
  logger.info('[CRON] Ledger Watchdog initialized (Every 5 mins).');

  // Secure Database Backup (Every Sunday at 3:00 AM)
  cron.schedule('0 3 * * 0', () => {
    logger.info('[CRON] Starting weekly encrypted database backup...');
    backupService.runEncryptedBackup();
  });

  // Queue Backlog Monitor (Runs every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('[CRON] Running Queue Backlog Monitor...');
      const pendingCount = await LedgerJob.countDocuments({ status: 'pending' });
      const oldestPending = await LedgerJob.findOne({ status: 'pending' }).sort({ createdAt: 1 }).select('createdAt');
      
      let oldestAgeMinutes = 0;
      if (oldestPending) {
        oldestAgeMinutes = (Date.now() - oldestPending.createdAt.getTime()) / 60000;
      }

      if (pendingCount > 100 || oldestAgeMinutes > 15) {
        logger.warn(`[QUEUE BACKLOG ALERT] Pending: ${pendingCount}, Oldest Age: ${Math.round(oldestAgeMinutes)} mins`);
        await emailService.sendSystemFailureAlert(
          'Ledger Queue Backlog Alert',
          `The ledger queue is experiencing a backlog.\nPending Jobs: ${pendingCount}\nOldest Job Age: ${Math.round(oldestAgeMinutes)} minutes.`
        );
      }
    } catch (err) {
      logger.error(`[CRON ERROR] Queue Backlog Monitor failed: ${err.message}`);
    }
  });

  // Daily Digest for Owners (Every day at 8:00 AM)
  cron.schedule('0 8 * * *', async () => {
    logger.info('[CRON] Generating Daily Digest for Owners...');
    try {
      const User = require('../models/User');
      const Tenant = require('../models/Tenant');
      const MonthlyRentRecord = require('../models/MonthlyRentRecord');
      
      const owners = await User.find({ role: { $in: ['owner', 'superadmin'] }, isActive: true });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const owner of owners) {
        if (owner.notificationPreferences?.dailyDigestEmails === false) continue;

        const metrics = await billingServiceV2.getSummaryMetrics(owner._id);
        const moveOutRequests = await Tenant.countDocuments({ ownerId: owner._id, exitDate: { $gte: today } });

        const summary = {
          overdueTenants: metrics[0]?.overdueCount || 0,
          pendingPayments: metrics[0]?.pendingCount || 0,
          collectionsToday: metrics[0]?.totalCollected || 0,
          moveOutRequests
        };

        await emailService.sendDailyDigestEmail(owner, summary).catch(() => null);
      }
    } catch (err) {
      logger.error(`[CRON ERROR] Daily digest failed: ${err.message}`);
    }
  }, { timezone: 'Asia/Kolkata' });
};

module.exports = { startCronJobs, runDailyJobs };
