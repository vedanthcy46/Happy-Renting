'use strict';

const router = require('express').Router();
const os = require('os');
const { authenticate, authorize } = require('../middleware/auth');
const NotificationQueue = require('../models/NotificationQueue');

// ── GET /api/system/health ───────────────────────────────────────────────
router.get('/health', authenticate, authorize('superadmin'), async (req, res, next) => {
  try {
    const queuePending = await NotificationQueue.countDocuments({ status: 'pending' });
    const queueFailed = await NotificationQueue.countDocuments({ status: 'failed' });
    const queueTotal = await NotificationQueue.countDocuments();

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

    const pending = await NotificationQueue.countDocuments({ status: 'pending', deadLetter: false });
    const failed = await NotificationQueue.countDocuments({ status: 'failed', deadLetter: false });
    const deadLetters = await NotificationQueue.countDocuments({ deadLetter: true });
    
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
        failed,
        deadLetters,
        sentToday,
        failedToday
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
