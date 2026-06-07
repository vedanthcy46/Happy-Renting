'use strict';

/*
 * ╔══════════════════════════════════════════════════════════╗
 * ║           HappyRent — Secure Express Server              ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Security layers applied:
 *  1. helmet       — HTTP security headers
 *  2. cors         — strict origin whitelist
 *  3. hpp          — HTTP parameter pollution prevention
 *  4. mongoSanitize— NoSQL injection prevention
 *  5. Rate limits  — auth: 10/15m  |  api: 100/15m
 *  6. express-validator (in controllers)
 *  7. Mongoose schema validation (in models)
 *  8. JWT + role-based access (in middleware/auth)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const morgan        = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp           = require('hpp');

const connectDB          = require('./config/db');
const logger             = require('./config/logger');
const { apiLimiter }     = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ── Routes ─────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const userRoutes     = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const roomRoutes     = require('./routes/roomRoutes');
const tenantRoutes   = require('./routes/tenantRoutes');
const paymentRoutes  = require('./routes/paymentRoutes');
const paymentRoutesV2 = require('./routes/paymentRoutesV2');
const ownerRequestRoutes = require('./routes/ownerRequestRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const healthRoutes    = require('./routes/healthRoutes');
const systemRoutes    = require('./routes/systemRoutes');
const { startCronJobs } = require('./jobs/cronJobs');
const ledgerQueueService = require('./services/ledgerQueueService');
const { initKeepAlive } = require('./services/keepAliveService');

// ── Connect to DB ──────────────────────────────────────────────────────────
const billingServiceV2 = require('./services/billingServiceV2');

(async () => {
  await connectDB();
  await billingServiceV2.migrateExistingTenants();
  
  // Startup validation for data integrity
  try {
    const MonthlyRentRecord = require('./models/MonthlyRentRecord');
    const missingFields = await MonthlyRentRecord.countDocuments({
      $or: [
        { fullRentAmount: { $exists: false } },
        { rentAmountAtGeneration: { $exists: false } },
        { migrationVersion: { $exists: false } },
        { migrationVersion: 0 }
      ]
    });
    
    if (missingFields > 0) {
      logger.warn(`[DATA INTEGRITY] Found ${missingFields} legacy rent records requiring backfill. Running automatic backfill...`);
      
      const cursor = MonthlyRentRecord.find({
        $or: [
          { fullRentAmount: { $exists: false } },
          { rentAmountAtGeneration: { $exists: false } },
          { migrationVersion: { $exists: false } },
          { migrationVersion: 0 }
        ]
      }).cursor();
      
      let modified = 0;
      for await (const record of cursor) {
        const updateDoc = { $set: { migrationVersion: 1 } };
        if (record.fullRentAmount == null) updateDoc.$set.fullRentAmount = record.totalRent;
        if (record.rentAmountAtGeneration == null) updateDoc.$set.rentAmountAtGeneration = record.totalRent;
        
        const result = await MonthlyRentRecord.updateOne({ _id: record._id }, updateDoc);
        if (result.modifiedCount > 0) modified++;
      }
      logger.info(`[DATA INTEGRITY] Automatic backfill complete. Modified ${modified} records.`);
    }
  } catch (err) {
    logger.error(`[DATA INTEGRITY] Failed to validate legacy rent records: ${err.message}`);
  }

  initKeepAlive();
})();

const app = express();

// ── 1. Helmet (HTTP security headers) ─────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);

// ── 2. CORS (strict whitelist) ─────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(
  cors({
    origin     : true, // Reflect request origin (Allows all)
    credentials: true,
    methods    : ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── 3. Body parsing ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));      // Deny large payloads
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── 4. NoSQL injection sanitization ───────────────────────────────────────
app.use(mongoSanitize());

// ── 5. HTTP parameter pollution prevention ─────────────────────────────────
app.use(hpp());

// ── 6. Request logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: msg => logger.http(msg.trim()) } }));
}

// ── 7. Global API rate limit ───────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── 8. Health check & Server ID ──────────────────────────────────────────
const SERVER_ID = process.env.SERVER_ID || 'primary';

app.use((req, res, next) => {
  res.setHeader('X-Server-ID', SERVER_ID);
  next();
});

app.use('/health', healthRoutes);

// ── 9. API Routes ──────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/rooms',      roomRoutes);
app.use('/api/tenants',    tenantRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/v2/payments',   paymentRoutesV2); // New ledger-based system
app.use('/api/complaints', complaintRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/owner-requests', ownerRequestRoutes);

// ── 10. 404 + Global error handler ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start the Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`HappyRent API running on port ${PORT} [${process.env.NODE_ENV}]`);
  
  // Free Tier / Unified Mode
  // If the user is on Render Free, they cannot run a separate worker process.
  // We initialize the background tasks directly within the API process here.
  logger.info('[SERVER] Starting embedded background worker (Free Tier compatibility mode)');
  startCronJobs();
  ledgerQueueService.startQueueWorker();
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.warn(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled rejections — log and exit so PM2/Docker restarts
process.on('unhandledRejection', (reason) => {
  logger.error(`[UNHANDLED REJECTION] ${reason}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error(`[UNCAUGHT EXCEPTION] ${err.message}`, err);
  server.close(() => process.exit(1));
});

module.exports = app; // for testing
