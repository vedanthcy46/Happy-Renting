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
 * Send rent reminders to every tenant with pending rent for the current month.
 * Uses the existing push/notification service so reminders appear in-app AND
 * as push notifications.
 * @param {object} [opts]
 * @param {string} [opts.ownerId] - if provided, only remind tenants of this owner.
 */
async function sendRentReminders(opts) {
  opts = opts || {};
  const cur = monthKey();
  const filter = { month: cur, remainingAmount: { $gt: 0 } };
  if (opts.ownerId) filter.ownerId = opts.ownerId;

  const records = await MonthlyRentRecord.find(filter)
    .populate({ path: 'tenantId', select: 'userId' })
    .lean();

  let sent = 0;
  for (const r of records) {
    const tenantUserId = r.tenantId && r.tenantId.userId;
    if (!tenantUserId) continue;
    try {
      await NotificationService.sendPushNotification({
        userId: tenantUserId,
        i18nKey: 'reminder.rentReminder.title',
        i18nBodyKey: 'reminder.rentReminder.body',
        i18nVars: { amount: r.remainingAmount, month: r.month },
        type: 'rent_reminder',
        data: { rentRecordId: String(r._id), month: r.month },
      });
      sent++;
    } catch (err) {
      // Already logged by the notification service; continue with the rest.
    }
  }
  return { month: cur, sent, totalFound: records.length };
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