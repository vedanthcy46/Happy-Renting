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

const startCronJobs = () => {
  // Run every day at 00:01 (1 minute past midnight)
  cron.schedule('1 0 * * *', async () => {
    logger.info('[CRON] Starting daily rent status check...');
    
    try {
      const today    = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

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
        logger.info(`[CRON] Payment ${p._id} marked as OVERDUE`);
      }

      logger.info(`[CRON] Daily check completed. Reminders: ${pendingReminders.length}, Overdue: ${overduePayments.length}`);
    } catch (err) {
      logger.error(`[CRON ERROR] ${err.message}`);
    }
  });

  logger.info('[CRON] Scheduled jobs initialized.');
};

module.exports = { startCronJobs };
