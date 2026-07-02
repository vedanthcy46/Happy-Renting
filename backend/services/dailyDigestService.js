'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../config/logger');
const User = require('../models/User');
const DailyDigestLog = require('../models/DailyDigestLog');
const DailyMetricsSnapshot = require('../models/DailyMetricsSnapshot');
const reportingService = require('./reportingService');
const emailService = require('./emailService');

const OWNER_TEMPLATE = fs.readFileSync(path.join(__dirname, '../templates/email/ownerDailyDigest.html'), 'utf8');
const ADMIN_TEMPLATE = fs.readFileSync(path.join(__dirname, '../templates/email/adminDailyDigest.html'), 'utf8');

const TEMPLATE_VERSION = 'v1';

const normalizeOwnerDigestMetrics = (metrics = {}) => ({
  pendingRent: Number(metrics.pendingRent) || 0,
  overdueTenants: Number(metrics.overdueTenants) || 0,
  unverifiedPayments: Number(metrics.unverifiedPayments) || 0,
  upcomingMoveOuts: Number(metrics.upcomingMoveOuts) || 0,
  openComplaints: Number(metrics.openComplaints) || 0,
  collectedToday: Number(metrics.collectedToday) || 0,
  walletBalance: Number(metrics.walletBalance) || 0,
  withdrawableAmount: Number(metrics.withdrawableAmount) || 0,
  totalRooms: Number(metrics.totalRooms) || 0,
  occupiedRooms: Number(metrics.occupiedRooms) || 0,
  vacantRooms: Number(metrics.vacantRooms) || 0,
  occupancyRate: Number(metrics.occupancyRate) || 0,
});

const normalizeAdminDigestMetrics = (metrics = {}) => {
  const normalized = {
    totalCollectionsToday: Number(metrics.totalCollectionsToday) || 0,
    activeOwners: Number(metrics.activeOwners) || 0,
    activeTenants: Number(metrics.activeTenants) || 0,
    newRegistrationsToday: Number(metrics.newRegistrationsToday) || 0,
    failedPaymentsToday: Number(metrics.failedPaymentsToday) || 0,
    pendingWithdrawals: Number(metrics.pendingWithdrawals) || 0,
    queueBacklog: Number(metrics.queueBacklog) || 0,
    deadLetterJobs: Number(metrics.deadLetterJobs) || 0,
    workerHealth: metrics.workerHealth || 'Healthy',
  };

  normalized.workerHealthStyle = normalized.workerHealth === 'Healthy' ? 'border-green' : 'border-red';
  normalized.deadLetterStyle = normalized.deadLetterJobs > 0 ? 'border-red' : 'border-green';

  return normalized;
};

/**
 * ── PUBLISHERS ─────────────────────────────────────────────────────────────
 */

const generateOwnerDigests = async () => {
  const dateStr = new Date().toISOString().split('T')[0];
  const batchSize = parseInt(process.env.DIGEST_QUEUE_BATCH_SIZE || '50', 10);
  let skip = 0;
  
  logger.info(`[OWNER DIGEST] Starting generation for ${dateStr}`);

  while (true) {
    const owners = await User.find({ role: 'owner', isActive: true })
      .skip(skip)
      .limit(batchSize)
      .lean();
      
    if (owners.length === 0) break;

    const snapshotOps = [];
    const logOps = [];

    for (const owner of owners) {
      if (owner.notificationPreferences?.dailyDigestEmails === false) continue;

      // Collect metrics
      const [financial, occupancy, collection, complaint, alerts] = await Promise.all([
        reportingService.getOwnerFinancialMetrics(owner._id),
        reportingService.getOwnerOccupancyMetrics(owner._id),
        reportingService.getOwnerCollectionMetrics(owner._id, dateStr),
        reportingService.getOwnerComplaintMetrics(owner._id),
        reportingService.getOwnerAlerts(owner._id, dateStr)
      ]);

      const metrics = normalizeOwnerDigestMetrics({ ...financial, ...occupancy, ...collection, ...complaint, ...alerts });

      snapshotOps.push({
        updateOne: {
          filter: { ownerId: owner._id, date: dateStr },
          update: { $set: { metrics } },
          upsert: true
        }
      });

      logOps.push({
        updateOne: {
          filter: { userId: owner._id, digestDate: dateStr, digestType: 'owner_daily' },
          update: {
            $setOnInsert: {
              role: 'owner',
              status: 'pending',
              attempts: 0,
              maxAttempts: parseInt(process.env.DIGEST_MAX_RETRIES || '5', 10),
              templateVersion: TEMPLATE_VERSION
            }
          },
          upsert: true
        }
      });
    }

    if (snapshotOps.length > 0) await DailyMetricsSnapshot.bulkWrite(snapshotOps);
    if (logOps.length > 0) await DailyDigestLog.bulkWrite(logOps);

    logger.info(`[OWNER DIGEST] Queued ${logOps.length} owners in this batch.`);
    skip += batchSize;
  }
};

const generateAdminDigests = async () => {
  const dateStr = new Date().toISOString().split('T')[0];
  
  logger.info(`[ADMIN DIGEST] Starting generation for ${dateStr}`);

  const superadmins = await User.find({ role: 'superadmin', isActive: true }).lean();
  if (superadmins.length === 0) return;

  const [platform, system] = await Promise.all([
    reportingService.getAdminPlatformMetrics(dateStr),
    reportingService.getAdminSystemMetrics()
  ]);

  const metrics = normalizeAdminDigestMetrics({ ...platform, ...system });

  // Cache platform snapshot
  await DailyMetricsSnapshot.updateOne(
    { ownerId: null, date: dateStr },
    { $set: { metrics } },
    { upsert: true }
  );

  const logOps = superadmins.map(admin => ({
    updateOne: {
      filter: { userId: admin._id, digestDate: dateStr, digestType: 'admin_daily' },
      update: {
        $setOnInsert: {
          role: 'superadmin',
          status: 'pending',
          attempts: 0,
          maxAttempts: parseInt(process.env.DIGEST_MAX_RETRIES || '5', 10),
          templateVersion: TEMPLATE_VERSION
        }
      },
      upsert: true
    }
  }));

  await DailyDigestLog.bulkWrite(logOps);
  logger.info(`[ADMIN DIGEST] Queued ${logOps.length} admins.`);
};

/**
 * ── CONSUMER ───────────────────────────────────────────────────────────────
 */

const renderTemplate = (template, data) => {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : '';
  });
};

const processDigestQueue = async () => {
  const workerId = crypto.randomUUID();
  let job;
  
  while (true) {
    job = await DailyDigestLog.findOneAndUpdate(
      { status: 'pending' },
      { 
        $set: { 
          status: 'processing', 
          workerId, 
          processingStartedAt: new Date() 
        } 
      },
      { new: true, sort: { createdAt: 1 } }
    ).populate('userId');

    if (!job) break; // Queue empty

    try {
      if (!job.userId || !job.userId.isActive) {
        throw new Error('User inactive or deleted');
      }

      job.attempts += 1;

      // Fetch cached snapshot
      const snapshotQuery = job.role === 'owner' ? { ownerId: job.userId._id, date: job.digestDate } : { ownerId: null, date: job.digestDate };
      const snapshot = await DailyMetricsSnapshot.findOne(snapshotQuery).lean();
      
      if (!snapshot) {
        throw new Error('Metrics snapshot missing for this date');
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const data = job.digestType === 'owner_daily'
        ? { ...normalizeOwnerDigestMetrics(snapshot.metrics), date: job.digestDate, ownerName: job.userId.name }
        : { ...normalizeAdminDigestMetrics(snapshot.metrics), date: job.digestDate, ownerName: job.userId.name };

      let html = '';
      let subject = '';

      if (job.digestType === 'owner_daily') {
        data.dashboardUrl = `${frontendUrl}/login`;
        data.openComplaintsStyle = data.openComplaints > 0 ? 'value-red' : 'value-green';
        html = renderTemplate(OWNER_TEMPLATE, data);
        subject = `🏠 Happy Renting Daily Summary - ${job.digestDate}`;
      } else if (job.digestType === 'admin_daily') {
        data.adminDashboardUrl = `${frontendUrl}/login`;
        data.workerHealthStyle = data.workerHealth === 'Healthy' ? 'border-green' : 'border-red';
        data.deadLetterStyle = data.deadLetterJobs > 0 ? 'border-red' : 'border-green';
        html = renderTemplate(ADMIN_TEMPLATE, data);
        subject = `📊 Happy Renting Platform Report - ${job.digestDate}`;
      } else {
        throw new Error('Unsupported digest type');
      }

      await emailService.sendEmail(job.userId.email, subject, html);

      job.status = 'sent';
      job.sentAt = new Date();
      job.workerId = null;
      job.processingStartedAt = null;
      await job.save();

      logger.info(`[DAILY DIGEST] Sent ${job.digestType} to ${job.userId.email}`);
    } catch (err) {
      job.lastError = err.message;
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead_letter';
      } else {
        job.status = 'failed'; // We can let cron pick up failed/pending later, or revert to pending
      }
      job.workerId = null;
      job.processingStartedAt = null;
      await job.save();
      logger.error(`[DAILY DIGEST] Failed sending ${job.digestType} for user ${job.userId._id}: ${err.message}`);
    }
  }
};

/**
 * ── WATCHDOG ───────────────────────────────────────────────────────────────
 */

const runDigestWatchdog = async () => {
  const timeoutMins = parseInt(process.env.DIGEST_WATCHDOG_MINUTES || '15', 10);
  const cutoff = new Date(Date.now() - timeoutMins * 60 * 1000);

  const result = await DailyDigestLog.updateMany(
    { status: 'processing', processingStartedAt: { $lte: cutoff } },
    { 
      $set: { 
        status: 'pending', 
        workerId: null, 
        processingStartedAt: null,
        lastError: 'Watchdog reset stuck job' 
      } 
    }
  );

  if (result.modifiedCount > 0) {
    logger.warn(`[DAILY DIGEST WATCHDOG] Reset ${result.modifiedCount} stuck digest jobs to pending.`);
  }
  
  // Also pick up 'failed' jobs that haven't maxed out attempts
  const failedResult = await DailyDigestLog.updateMany(
    { status: 'failed', $expr: { $lt: ["$attempts", "$maxAttempts"] } },
    { $set: { status: 'pending' } }
  );
  
  if (failedResult.modifiedCount > 0) {
    logger.info(`[DAILY DIGEST WATCHDOG] Re-queued ${failedResult.modifiedCount} failed digest jobs.`);
  }
};

module.exports = {
  normalizeOwnerDigestMetrics,
  normalizeAdminDigestMetrics,
  generateOwnerDigests,
  generateAdminDigests,
  processDigestQueue,
  runDigestWatchdog
};
