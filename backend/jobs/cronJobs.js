'use strict';

const cron         = require('node-cron');
const Payment      = require('../models/Payment');
const emailService = require('../services/emailService');
const logger       = require('../config/logger');
const NotificationQueue = require('../models/NotificationQueue');
const LedgerJob = require('../models/LedgerJob');
const SystemHealth = require('../models/SystemHealth');

/**
 * cronJobs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled tasks for rent tracking and automated notifications.
 */

const billingServiceV2 = require('../services/billingServiceV2');
const backupService = require('../services/backupService');
const ledgerQueueService = require('../services/ledgerQueueService');
const walletService = require('../services/walletService');
const dailyDigestService = require('../services/dailyDigestService');

const runDailyJobs = async () => {
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

    try {
      logger.info('[CRON-V2] Charging landlord monthly subscriptions...');
      await walletService.chargeMonthlySubscriptions();
    } catch (err) {
      logger.error(`[CRON ERROR] chargeMonthlySubscriptions failed: ${err.message}`);
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

  // Heartbeat Loop (every 30 seconds)
  setInterval(async () => {
    try {
      await SystemHealth.findOneAndUpdate(
        { key: 'worker' },
        { lastHeartbeatAt: new Date(), status: 'healthy' },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) {
      logger.error(`[WORKER HEARTBEAT] Failed to update: ${err.message}`);
    }
  }, 30000);

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

  // Daily Digest Publishers
  const ownerCron = process.env.OWNER_DIGEST_CRON || '0 8 * * *';
  cron.schedule(ownerCron, async () => {
    try {
      await dailyDigestService.generateOwnerDigests();
    } catch (err) {
      logger.error(`[CRON ERROR] generateOwnerDigests failed: ${err.message}`);
    }
  }, { timezone: 'Asia/Kolkata' });

  const adminCron = process.env.ADMIN_DIGEST_CRON || '0 8 * * *';
  cron.schedule(adminCron, async () => {
    try {
      await dailyDigestService.generateAdminDigests();
    } catch (err) {
      logger.error(`[CRON ERROR] generateAdminDigests failed: ${err.message}`);
    }
  }, { timezone: 'Asia/Kolkata' });

  // Scheduled Account Deletion Processing (Every 6 hours)
  const accountDeletionService = require('../services/accountDeletionService');
  cron.schedule('0 */6 * * *', async () => {
    try {
      logger.info('[CRON] Processing scheduled account deletions...');
      await accountDeletionService.processScheduledDeletions();
      logger.info('[CRON] Scheduled deletion processing completed.');
    } catch (err) {
      logger.error(`[CRON ERROR] processScheduledDeletions failed: ${err.message}`);
    }
  });
  logger.info('[CRON] Scheduled deletion processor initialized (Every 6 hours).');

  // Daily Digest Processor (Every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    try {
      await dailyDigestService.processDigestQueue();
    } catch (err) {
      logger.error(`[CRON ERROR] processDigestQueue failed: ${err.message}`);
    }
  });

  // Daily Digest Watchdog (Every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    try {
      await dailyDigestService.runDigestWatchdog();
    } catch (err) {
      logger.error(`[CRON ERROR] runDigestWatchdog failed: ${err.message}`);
    }
  });
};

module.exports = { startCronJobs, runDailyJobs };
