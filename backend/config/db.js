'use strict';

const mongoose = require('mongoose');
const logger   = require('./logger');

/**
 * Establishes a connection to MongoDB Atlas.
 * Uses connection pooling and emits lifecycle events for observability.
 */
const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI || 'mongodb://localhost:27017/rental';
    
    // Standalone MongoDB instances do not support retryable writes.
    if (uri.includes('localhost') && !uri.includes('retryWrites')) {
      uri += uri.includes('?') ? '&retryWrites=false' : '?retryWrites=false';
    }

    const conn = await mongoose.connect(uri, {
      // These options are the defaults in Mongoose 6+ but listed explicitly for clarity
      serverSelectionTimeoutMS : 5000,   // Fail fast if Atlas unreachable
      socketTimeoutMS          : 45000,  // Close sockets after 45 s of inactivity
      maxPoolSize              : 50,     // Handle concurrent load
      minPoolSize              : 5,      // Keep warm pool ready
      maxIdleTimeMS            : 30000,  // Recycle idle connections
      waitQueueTimeoutMS       : 5000,   // Fail fast on pool exhaustion
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    // Exit so the process manager (PM2 / Docker) restarts cleanly
    process.exit(1);
  }
};

// ── Lifecycle hooks ────────────────────────────────────────────────────────
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => logger.info('MongoDB reconnected'));

module.exports = connectDB;
