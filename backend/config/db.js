'use strict';

const mongoose = require('mongoose');
const logger   = require('./logger');

/**
 * Establishes a connection to MongoDB Atlas.
 * Uses connection pooling and emits lifecycle events for observability.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are the defaults in Mongoose 6+ but listed explicitly for clarity
      serverSelectionTimeoutMS : 5000,   // Fail fast if Atlas unreachable
      socketTimeoutMS          : 45000,  // Close sockets after 45 s of inactivity
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
