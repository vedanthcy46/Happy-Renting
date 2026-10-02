'use strict';

/**
 * automationService
 * ------------------------------------------------------------------
 * Phase 4 - "AI Automation". Unscheduled helpers that the app can run as
 * background jobs (currently: automatic rent reminders).
 *
 * This service is intentionally side-effect-safe: every function can be
 * triggered on demand (e.g. by the AI copilot for a single owner) or by a
 * daily cron for all owners.
 */

const logger            = require('../config/logger');
const NotificationService = require('./notificationService');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');

function monthKey(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/**
 * Send rent reminders to tenants with pending or overdue rent.
 * Uses the existing push/notification service so reminders appear in-app AND
 * as push notifications.
 * @param {object} [opts]
 * @param {string} [opts.ownerId] - if provided, only remind tenants of this owner.
 * @param {string} [opts.month]   - if provided, filter by specific occupancy month.
 */
async function sendRentReminders(opts) {
  opts = opts || {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Match all records with pending/partial/overdue rent
  const filter = {
    status: { $in: ['pending', 'partial', 'overdue'] },
    remainingAmount: { $gt: 0 }
  };
  if (opts.month) filter.month = opts.month;
  if (opts.ownerId) filter.ownerId = opts.ownerId;

  const records = await MonthlyRentRecord.find(filter)
    .populate({ path: 'tenantId', select: 'userId' })
    .populate({ path: 'userId', select: 'name email preferredLanguage' });

  let sent = 0;
  for (const r of records) {
    const tenantUser = r.userId || (r.tenantId && r.tenantId.userId);
    if (!tenantUser) continue;

    // Do not spam: skip if reminder was already sent today
    if (r.reminderSentAt) {
      const lastSent = new Date(r.reminderSentAt);
      lastSent.setHours(0, 0, 0, 0);
      if (lastSent.getTime() === today.getTime()) continue;
    }

    try {
      const targetUserId = tenantUser._id || tenantUser;
      const isOverdue = r.status === 'overdue';

      await NotificationService.sendPushNotification({
        userId: targetUserId,
        i18nKey: isOverdue ? 'reminder.overdue.title' : 'reminder.rentReminder.title',
        i18nBodyKey: isOverdue ? 'reminder.overdue.body' : 'reminder.rentReminder.body',
        i18nVars: { amount: r.remainingAmount, month: r.month },
        type: isOverdue ? 'rent_overdue' : 'rent_reminder',
        data: { rentRecordId: String(r._id), month: r.month },
      });

      await MonthlyRentRecord.updateOne(
        { _id: r._id },
        { $set: { reminderSent: true, reminderSentAt: new Date() } }
      );

      sent++;
    } catch (err) {
      logger.error(`[AUTOMATION] Failed to send reminder for record ${r._id}: ${err.message}`);
    }
  }

  return { sent, totalFound: records.length };
}

/**
 * Daily automation entrypoint for all owners (called by cron).
 */
async function runDailyAutomation() {
  const enabled = String(process.env.RENT_REMINDER_AUTOMATION_ENABLED || 'true') === 'true';
  if (!enabled) {
    logger.info('[AUTOMATION] Rent reminder automation disabled via env.');
    return { skipped: true };
  }
  const result = await sendRentReminders();
  logger.info('[AUTOMATION] Daily rent reminders: sent=' + result.sent + ' found=' + result.totalFound);
  return result;
}

module.exports = { sendRentReminders, runDailyAutomation, monthKey };