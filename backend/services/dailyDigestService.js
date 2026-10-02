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

const TEMPLATE_VERSION = 'v2';

const normalizeOwnerDigestMetrics = (metrics = {}) => {
  const periodDays = Number(metrics.periodDays) || parseInt(process.env.DIGEST_INTERVAL_DAYS || '15', 10);
  const collectedPeriod = Number(metrics.collectedPeriod || metrics.collectedToday || metrics.collectionsToday) || 0;

  return {
    pendingRent: Number(metrics.pendingRent) || 0,
    overdueTenants: Number(metrics.overdueTenants) || 0,
    unverifiedPayments: Number(metrics.unverifiedPayments) || 0,
    upcomingMoveOuts: Number(metrics.upcomingMoveOuts) || 0,
    openComplaints: Number(metrics.openComplaints) || 0,
    collectedPeriod,
    collectedToday: collectedPeriod, // Backward-compatible alias
    collectionsToday: collectedPeriod, // Backward-compatible alias
    walletBalance: Number(metrics.walletBalance) || 0,
    withdrawableAmount: Number(metrics.withdrawableAmount) || 0,
    totalRooms: Number(metrics.totalRooms) || 0,
    occupiedRooms: Number(metrics.occupiedRooms) || 0,
    vacantRooms: Number(metrics.vacantRooms) || 0,
    occupancyRate: Number(metrics.occupancyRate) || 0,
    newTenants: Number(metrics.newTenants) || 0,
    failedPayments: Number(metrics.failedPayments) || 0,
    periodDays,
  };
};

const normalizeAdminDigestMetrics = (metrics = {}) => {
  const periodDays = Number(metrics.periodDays) || parseInt(process.env.DIGEST_INTERVAL_DAYS || '15', 10);
  const totalCollections = Number(metrics.totalCollections || metrics.totalCollectionsPeriod || metrics.totalCollectionsToday || metrics.collectionsToday) || 0;
  const newRegistrations = Number(metrics.newRegistrations || metrics.newRegistrationsToday) || 0;
  const failedPayments = Number(metrics.failedPayments || metrics.failedPaymentsToday) || 0;

  const normalized = {
    totalCollections,
    totalCollectionsToday: totalCollections,
    activeOwners: Number(metrics.activeOwners) || 0,
    activeTenants: Number(metrics.activeTenants) || 0,
    newRegistrations,
    newRegistrationsToday: newRegistrations,
    failedPayments,
    failedPaymentsToday: failedPayments,
    pendingWithdrawals: Number(metrics.pendingWithdrawals) || 0,
    queueBacklog: Number(metrics.queueBacklog) || 0,
    deadLetterJobs: Number(metrics.deadLetterJobs) || 0,
    workerHealth: metrics.workerHealth || 'Healthy',
    periodDays,
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
  const periodDays = parseInt(process.env.DIGEST_INTERVAL_DAYS || '15', 10);

  // Interval check cutoff: skip owner if a digest was created/queued within the last N days
  // Grace margin of 1 hour to prevent minor cron time drift issues
  const cutoffTime = Date.now() - (periodDays * 24 * 60 * 60 * 1000 - 60 * 60 * 1000);
  const cutoffDate = new Date(cutoffTime);
  let skip = 0;
  
  logger.info(`[OWNER DIGEST] Evaluating digest generation for ${dateStr} (interval: ${periodDays} days)`);

  while (true) {
    const owners = await User.find({ 
      role: 'owner', 
      isActive: true,
      'subscription.plan': { $in: ['MONTHLY', 'ANNUAL', 'LIFETIME'] }
    })
      .skip(skip)
      .limit(batchSize)
      .lean();
      
    if (owners.length === 0) break;

    const snapshotOps = [];
    const logOps = [];

    for (const owner of owners) {
      if (owner.notificationPreferences?.dailyDigestEmails === false) continue;

      // INTERVAL GUARD: Check if a digest was already created for this owner within the last periodDays
      const recentDigest = await DailyDigestLog.findOne({
        userId: owner._id,
        digestType: 'owner_daily',
        createdAt: { $gte: cutoffDate }
      }).select('_id createdAt').lean();

      if (recentDigest) {
        // Owner has already received/queued a digest within the last N days. Do not send daily!
        continue;
      }

      // Collect metrics covering the entire periodDays interval
      const [financial, occupancy, collection, complaint, alerts] = await Promise.all([
        reportingService.getOwnerFinancialMetrics(owner._id),
        reportingService.getOwnerOccupancyMetrics(owner._id),
        reportingService.getOwnerCollectionMetrics(owner._id, dateStr, periodDays),
        reportingService.getOwnerComplaintMetrics(owner._id),
        reportingService.getOwnerAlerts(owner._id, dateStr, periodDays)
      ]);

      const metrics = normalizeOwnerDigestMetrics({
        ...financial,
        ...occupancy,
        ...collection,
        ...complaint,
        ...alerts,
        periodDays
      });

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

    logger.info(`[OWNER DIGEST] Queued ${logOps.length} owners in this batch (skipped owners within ${periodDays}-day window).`);
    skip += batchSize;
  }
};

const generateAdminDigests = async () => {
  const dateStr = new Date().toISOString().split('T')[0];
  const periodDays = parseInt(process.env.DIGEST_INTERVAL_DAYS || '15', 10);
  const cutoffTime = Date.now() - (periodDays * 24 * 60 * 60 * 1000 - 60 * 60 * 1000);
  const cutoffDate = new Date(cutoffTime);
  
  logger.info(`[ADMIN DIGEST] Evaluating admin digest for ${dateStr} (interval: ${periodDays} days)`);

  const superadmins = await User.find({ role: 'superadmin', isActive: true }).lean();
  if (superadmins.length === 0) return;

  // INTERVAL GUARD: Check if an admin digest was already created within the last periodDays
  const recentAdminDigest = await DailyDigestLog.findOne({
    role: 'superadmin',
    digestType: 'admin_daily',
    createdAt: { $gte: cutoffDate }
  }).select('_id createdAt').lean();

  if (recentAdminDigest) {
    logger.info(`[ADMIN DIGEST] Skipping admin digest: already sent within last ${periodDays} days.`);
    return;
  }

  const [platform, system] = await Promise.all([
    reportingService.getAdminPlatformMetrics(dateStr, periodDays),
    reportingService.getAdminSystemMetrics()
  ]);

  const metrics = normalizeAdminDigestMetrics({ ...platform, ...system, periodDays });

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
      { returnDocument: 'after', sort: { createdAt: 1 } }
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
      const periodDays = snapshot.metrics?.periodDays || parseInt(process.env.DIGEST_INTERVAL_DAYS || '15', 10);

      // Compute date range for display
      const endDate = new Date(job.digestDate);
      const startDate = new Date(endDate.getTime() - (periodDays - 1) * 24 * 60 * 60 * 1000);
      const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const dateRange = periodDays === 1
        ? fmtDate(endDate)
        : `${fmtDate(startDate)} – ${fmtDate(endDate)}`;
      const periodLabel = periodDays === 1 ? 'Daily' : `${periodDays}-Day`;

      const data = job.digestType === 'owner_daily'
        ? {
            ...normalizeOwnerDigestMetrics(snapshot.metrics),
            date: job.digestDate,
            dateRange,
            periodLabel: `${periodLabel} Summary`,
            periodDays,
            ownerName: job.userId.name
          }
        : {
            ...normalizeAdminDigestMetrics(snapshot.metrics),
            date: job.digestDate,
            dateRange,
            periodLabel: `${periodLabel} Report`,
            periodDays,
            ownerName: job.userId.name
          };

      let html = '';
      let subject = '';

      if (job.digestType === 'owner_daily') {
        data.dashboardUrl = `${frontendUrl}/login`;
        data.openComplaintsStyle = data.openComplaints > 0 ? 'value-red' : 'value-green';
        html = renderTemplate(OWNER_TEMPLATE, data);
        subject = `🏠 Happy Renting ${periodLabel} Summary (${dateRange})`;
      } else if (job.digestType === 'admin_daily') {
        data.adminDashboardUrl = `${frontendUrl}/login`;
        data.workerHealthStyle = data.workerHealth === 'Healthy' ? 'border-green' : 'border-red';
        data.deadLetterStyle = data.deadLetterJobs > 0 ? 'border-red' : 'border-green';
        html = renderTemplate(ADMIN_TEMPLATE, data);
        subject = `📊 Happy Renting Platform Report (${dateRange})`;
      } else {
        throw new Error('Unsupported digest type');
      }

      await emailService.sendEmail(job.userId.email, subject, html);

      job.status = 'sent';
      job.sentAt = new Date();
      job.workerId = null;
      job.processingStartedAt = null;
      await job.save();

      logger.info(`[PERIODIC DIGEST] Sent ${job.digestType} (${periodLabel}) to ${job.userId.email}`);
    } catch (err) {
      job.lastError = err.message;
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead_letter';
      } else {
        job.status = 'failed';
      }
      job.workerId = null;
      job.processingStartedAt = null;
      await job.save();
      logger.error(`[PERIODIC DIGEST] Failed sending ${job.digestType} for user ${job.userId._id}: ${err.message}`);
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
  
  // Re-queue failed jobs that haven't maxed out attempts
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
