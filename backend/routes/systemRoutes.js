'use strict';

const router = require('express').Router();
const os = require('os');
const { authenticate, authorize } = require('../middleware/auth');
const NotificationQueue = require('../models/NotificationQueue');

// ── GET /api/system/health ───────────────────────────────────────────────
// Exposes system observability metrics to superadmins
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

module.exports = router;
