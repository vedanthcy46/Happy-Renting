'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const { startCronJobs } = require('./jobs/cronJobs');
const ledgerQueueService = require('./services/ledgerQueueService');
const SystemHealth = require('./models/SystemHealth');

(async () => {
  try {
    logger.info(`[WORKER BOOT] Starting process with PID: ${process.pid}`);
    logger.info('[WORKER BOOT] Connecting to MongoDB...');
    await connectDB();
    logger.info('[WORKER BOOT] Connected to MongoDB.');

    mongoose.connection.once('open', () => {
      logger.info('[WORKER] MongoDB Connected (Event Emitted)');
    });

    // Start background processes
    startCronJobs();
    logger.info('[CRON] Started');

    ledgerQueueService.startQueueWorker();
    logger.info('[QUEUE] Started');

    logger.info(`[WORKER] Started successfully. PID: ${process.pid}`);

    // Worker Heartbeat Loop (every 30 seconds)
    setInterval(async () => {
      try {
        await SystemHealth.findOneAndUpdate(
          { key: 'worker' },
          { lastHeartbeatAt: new Date(), status: 'healthy' },
          { upsert: true, new: true }
        );
      } catch (err) {
        logger.error(`[WORKER HEARTBEAT] Failed to update: ${err.message}`);
      }
    }, 30000);

  } catch (err) {
    logger.error(`[WORKER BOOT ERROR] ${err.message}`);
    process.exit(1);
  }
})();

// Graceful shutdown
const shutdown = (signal) => {
  logger.warn(`[WORKER] ${signal} received. Shutting down gracefully...`);
  mongoose.connection.close(false, () => {
    logger.info('[WORKER] MongoDB connection closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`[WORKER UNHANDLED REJECTION] ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error(`[WORKER UNCAUGHT EXCEPTION] ${err.message}`, err);
  process.exit(1);
});
