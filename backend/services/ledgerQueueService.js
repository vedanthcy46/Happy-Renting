'use strict';

const LedgerJob = require('../models/LedgerJob');
const Tenant = require('../models/Tenant');
const logger = require('../config/logger');
const { recalculateTenantLedger } = require('./ledgerRebuildEngine');

/**
 * Enqueue a new ledger rebuild job with debouncing.
 */
const enqueueRebuild = async ({ tenantId, triggerSource, priority = 'normal', requestedBy = null, affectedMonth = null }) => {
  // Check if a pending job already exists for this tenant
  const existingPending = await LedgerJob.findOne({ tenantId, status: 'pending' });

  if (existingPending) {
    // Debounce: Merge requests. If the new request has higher priority, upgrade it.
    const priorityWeights = { low: 0, normal: 1, high: 2 };
    let needsSave = false;

    if (priorityWeights[priority] > priorityWeights[existingPending.priority]) {
      existingPending.priority = priority;
      needsSave = true;
    }

    // Determine affectedMonth: If the existing job has a null affectedMonth (rebuild from start), keep it null.
    // Otherwise, if new affectedMonth is older than the existing one, update it to the older month.
    // For simplicity, we just set it to null if multiple updates conflict, forcing a full check.
    if (existingPending.affectedMonth && existingPending.affectedMonth !== affectedMonth) {
      existingPending.affectedMonth = null;
      needsSave = true;
    }

    existingPending.triggerSource = triggerSource; // Keep latest trigger source
    if (needsSave) {
      await existingPending.save();
    }
    logger.info(`[LEDGER QUEUE] Debounced/Merged rebuild request for tenant=${tenantId}`);
    return existingPending;
  }

  // Create new pending job
  const job = await LedgerJob.create({
    tenantId,
    triggerSource,
    priority,
    requestedBy,
    affectedMonth
  });

  logger.info(`[LEDGER QUEUE] Enqueued rebuild job for tenant=${tenantId} (priority=${priority})`);
  return job;
};


// Refactored fetch logic
const fetchHighestPriorityJob = async () => {
  const priorities = ['high', 'normal', 'low'];
  for (const prio of priorities) {
    const job = await LedgerJob.findOneAndUpdate(
      { status: 'pending', priority: prio },
      { 
        status: 'processing', 
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
        $inc: { attempts: 1 }
      },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    );
    if (job) return job;
  }
  return null;
};

const processQueue = async () => {
  const job = await fetchHighestPriorityJob();
  if (!job) return; // Queue empty

  logger.info(`[LEDGER WORKER] Started processing job=${job._id} for tenant=${job.tenantId}`);

  // Heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    try {
      await LedgerJob.updateOne({ _id: job._id }, { lastHeartbeatAt: new Date() });
    } catch (e) {
      logger.error(`[LEDGER WORKER] Failed to update heartbeat for job=${job._id}: ${e.message}`);
    }
  }, 30000); // 30 seconds

  let tenantLocked = false;
  try {
    // 2. Acquire Tenant Ledger Lock
    const lockAcquired = await Tenant.findOneAndUpdate(
      { _id: job.tenantId, ledgerLocked: false },
      { ledgerLocked: true, ledgerLockedAt: new Date() }
    );

    if (!lockAcquired) {
      throw new Error('Could not acquire tenant ledger lock. Another process may be running.');
    }
    tenantLocked = true;

    // 3. Execute Core Engine
    const startTime = Date.now();
    await recalculateTenantLedger(job.tenantId, job._id, job.triggerSource, job.affectedMonth);
    
    // 4. Mark Completed
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
    logger.info(`[LEDGER WORKER] Successfully completed job=${job._id} in ${Date.now() - startTime}ms`);

  } catch (error) {
    logger.error(`[LEDGER WORKER] Job=${job._id} failed: ${error.message}`);
    
    job.error = error.message;
    if (job.attempts >= job.maxAttempts) {
      job.status = 'dead_letter';
      logger.error(`[LEDGER DEAD LETTER] Job=${job._id} exceeded max attempts and is now dead.`);
    } else {
      job.status = 'failed'; // Or pending for retry? Usually failed requires admin, or we reset to pending via watchdog. Let's set it to pending for auto-retry, or let watchdog retry.
      // We will set to 'pending' to retry, or 'failed' if we want manual intervention.
      // The requirement says "After 5 failures, status becomes permanently_failed/dead_letter". So we set to 'pending' so it retries up to 5 times.
      job.status = 'pending';
    }
    await job.save();
  } finally {
    clearInterval(heartbeatInterval);

    // Release Tenant Lock
    if (tenantLocked) {
      await Tenant.updateOne({ _id: job.tenantId }, { ledgerLocked: false, ledgerLockedAt: null });
    }
  }

  // Process next job immediately if there is one
  setImmediate(processQueue);
};

let workerRunning = false;
const startQueueWorker = () => {
  if (workerRunning) return;
  workerRunning = true;
  logger.info('[LEDGER WORKER] Worker started');
  
  // Continuous polling loop
  const poll = async () => {
    try {
      const pendingCount = await LedgerJob.countDocuments({ status: 'pending' });
      if (pendingCount > 0) {
        await processQueue();
      }
    } catch (err) {
      logger.error(`[LEDGER WORKER POLL ERROR] ${err.message}`);
    }
    setTimeout(poll, 5000); // Poll every 5s
  };
  
  poll();
};

/**
 * Watchdog: Recovers dead jobs and clears stuck locks.
 */
const runWatchdog = async () => {
  logger.info('[LEDGER WATCHDOG] Running health checks...');
  const now = new Date();
  
  // 1. Recover dead jobs (processing > 5 mins without heartbeat)
  const deadJobThreshold = new Date(now.getTime() - 5 * 60 * 1000);
  const deadJobs = await LedgerJob.find({
    status: 'processing',
    lastHeartbeatAt: { $lt: deadJobThreshold }
  });

  for (const job of deadJobs) {
    logger.warn(`[LEDGER WATCHDOG] Recovering dead job=${job._id}`);
    if (job.attempts >= job.maxAttempts) {
      job.status = 'dead_letter';
      job.error = 'Job died (heartbeat timeout) and exceeded max attempts.';
    } else {
      job.status = 'pending'; // Re-queue
      job.error = 'Job died (heartbeat timeout). Re-queued by watchdog.';
    }
    await job.save();
  }

  // 2. Clear stuck tenant locks (> 5 mins dead heartbeat)
  const stuckLocksResult = await Tenant.updateMany(
    { ledgerLocked: true, _id: { $in: deadJobs.map(j => j.tenantId) } },
    { $set: { ledgerLocked: false, ledgerLockedAt: null } }
  );

  if (stuckLocksResult.modifiedCount > 0) {
    logger.warn(`[LEDGER WATCHDOG] Cleared ${stuckLocksResult.modifiedCount} stuck tenant ledger locks associated with dead jobs.`);
  }

  // Also catch edge case where lock is true but NO processing job exists at all (orphaned lock)
  const processingJobs = await LedgerJob.find({ status: 'processing' }).select('tenantId');
  const processingTenantIds = processingJobs.map(j => j.tenantId);
  const orphanedLocksResult = await Tenant.updateMany(
    { ledgerLocked: true, ledgerLockedAt: { $lt: deadJobThreshold }, _id: { $nin: processingTenantIds } },
    { $set: { ledgerLocked: false, ledgerLockedAt: null } }
  );

  if (orphanedLocksResult.modifiedCount > 0) {
    logger.warn(`[LEDGER WATCHDOG] Cleared ${orphanedLocksResult.modifiedCount} orphaned tenant ledger locks.`);
  }
};

module.exports = {
  enqueueRebuild,
  startQueueWorker,
  runWatchdog
};
