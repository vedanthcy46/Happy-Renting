'use strict';

const router = require('express').Router();
const os = require('os');
const { authenticate, authorize } = require('../middleware/auth');
const NotificationQueue = require('../models/NotificationQueue');
const LedgerJob = require('../models/LedgerJob');
const SystemHealth = require('../models/SystemHealth');
const { runDailyJobs } = require('../jobs/cronJobs');

// ── GET /api/system/health ───────────────────────────────────────────────
router.get('/health', authenticate, authorize('superadmin'), async (req, res, next) => {
  try {
    const queuePending = await NotificationQueue.countDocuments({ status: 'pending' });
    const queueFailed = await NotificationQueue.countDocuments({ status: 'failed' });
    const queueTotal = await NotificationQueue.countDocuments();

    const workerHealth = await SystemHealth.findOne({ key: 'worker' });
    const now = new Date();
    let workerStatus = 'unhealthy';
    if (workerHealth && (now - workerHealth.lastHeartbeatAt < 60000)) {
        workerStatus = 'healthy';
    }

    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
    };

    const processMemory = process.memoryUsage();

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: {
        pending: queuePending,
        failed: queueFailed,
        total: queueTotal,
        backlog: queuePending + queueFailed,
      },
      worker: workerStatus,
      cron: workerStatus, // Cron runs in same process as worker
      lastHeartbeat: workerHealth ? workerHealth.lastHeartbeatAt : null,
      systemMemory,
      processMemory: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
      },
      uptime: process.uptime()
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/system/queue-metrics ──────────────────────────────────────────
router.get('/queue-metrics', authenticate, authorize('superadmin'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = await LedgerJob.countDocuments({ status: 'pending' });
    const processing = await LedgerJob.countDocuments({ status: 'processing' });
    const failed = await LedgerJob.countDocuments({ status: 'failed' });
    const deadLetters = await LedgerJob.countDocuments({ status: 'dead_letter' });
    
    const oldestPending = await LedgerJob.findOne({ status: 'pending' }).sort({ createdAt: 1 }).select('createdAt');
    const oldestProcessing = await LedgerJob.findOne({ status: 'processing' }).sort({ startedAt: 1 }).select('startedAt');
    const lastSuccessful = await LedgerJob.findOne({ status: 'completed' }).sort({ completedAt: -1 }).select('completedAt');

    const recentCompleted = await LedgerJob.find({ status: 'completed', completedAt: { $exists: true }, startedAt: { $exists: true } }).sort({ completedAt: -1 }).limit(100).select('startedAt completedAt');
    let avgDuration = 0;
    if (recentCompleted.length > 0) {
      const totalDuration = recentCompleted.reduce((acc, job) => acc + (job.completedAt - job.startedAt), 0);
      avgDuration = Math.round(totalDuration / recentCompleted.length);
    }
    
    const sentToday = await NotificationQueue.countDocuments({
      status: 'sent',
      updatedAt: { $gte: today }
    });
    
    const failedToday = await NotificationQueue.countDocuments({
      status: 'failed',
      updatedAt: { $gte: today }
    });

    res.status(200).json({
      success: true,
      metrics: {
        pending,
        processing,
        failed,
        deadLetters,
        oldestPendingAge: oldestPending ? Math.floor((new Date() - oldestPending.createdAt) / 1000) : 0,
        oldestProcessingAge: oldestProcessing ? Math.floor((new Date() - oldestProcessing.startedAt) / 1000) : 0,
        avgDurationMs: avgDuration,
        lastSuccessfulJob: lastSuccessful ? lastSuccessful.completedAt : null,
      }
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/system/trigger-daily-cron ────────────────────────────────────
router.post('/trigger-daily-cron', authenticate, authorize('superadmin'), async (req, res, next) => {
  try {
    // Run asynchronously to avoid blocking the API response
    runDailyJobs().catch(err => console.error('[TRIGGER CRON] Failed:', err));
    
    res.status(200).json({
      success: true,
      message: 'Daily rent status check and bill generation triggered successfully in the background.'
    });
  } catch (err) {
    next(err);
  }
});

// ── Notification Bell Routes ────────────────────────────────────────────────

const Notification = require('../models/Notification');

// GET /api/system/notifications — fetch my notifications (latest 30)
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/system/notifications/:id/read — mark one as read
router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/system/notifications/read-all — mark all as read
router.patch('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/system/notifications/clear-all — delete all my notifications
router.delete('/notifications/clear-all', authenticate, async (req, res, next) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/system/notifications/:id — delete one notification
router.delete('/notifications/:id', authenticate, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/system/audit-logs
const LedgerAuditLog = require('../models/LedgerAuditLog');
router.get('/audit-logs', authenticate, authorize('superadmin', 'owner'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    // Future expansion: filter by tenantId if provided

    const logs = await LedgerAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'tenantId',
        select: 'userId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .lean();

    const total = await LedgerAuditLog.countDocuments(query);

    res.json({
      success: true,
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
