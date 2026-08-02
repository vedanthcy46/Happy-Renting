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
const compression   = require('compression');

const connectDB          = require('./config/db');
const logger             = require('./config/logger');
const { apiLimiter }     = require('./middleware/rateLimiter');
const { createConcurrencyLimiter } = require('./middleware/concurrencyLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ── Routes ─────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const userRoutes     = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const roomRoutes     = require('./routes/roomRoutes');
const tenantRoutes   = require('./routes/tenantRoutes');
const paymentRoutes  = require('./routes/paymentRoutes');
const paymentRoutesV2 = require('./routes/paymentRoutesV2');
const walletRoutes    = require('./routes/walletRoutes');
const walletAdminRoutes = require('./routes/walletAdminRoutes');
const ownerRequestRoutes = require('./routes/ownerRequestRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const healthRoutes    = require('./routes/healthRoutes');
const systemRoutes    = require('./routes/systemRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { startCronJobs } = require('./jobs/cronJobs');
const ledgerQueueService = require('./services/ledgerQueueService');
const { initKeepAlive } = require('./services/keepAliveService');

// ── Connect to DB ──────────────────────────────────────────────────────────
const billingServiceV2 = require('./services/billingServiceV2');

(async () => {
  await connectDB();
  // Startup validation for data integrity
  try {
    const MigrationHistory = require('./models/MigrationHistory');
    const MIGRATION_ID = 'startup_v2_migration';
    const hasMigrated = await MigrationHistory.findOne({ migrationId: MIGRATION_ID });

    if (!hasMigrated) {
      await billingServiceV2.migrateExistingTenants();

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

      await MigrationHistory.create({ migrationId: MIGRATION_ID, status: 'completed' });
      logger.info(`[DATA INTEGRITY] Migration marked as completed.`);
    }
  } catch (err) {
    logger.error(`[DATA INTEGRITY] Failed to validate legacy rent records: ${err.message}`);
  }

  // Seed Platform Settings
  try {
    const walletService = require('./services/walletService');
    await walletService.getPlatformSettings();
    logger.info('[SERVER] Platform settings seeded / validated.');
  } catch (err) {
    logger.error(`[SERVER] Failed to seed platform settings: ${err.message}`);
  }

  initKeepAlive();
})();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render) for rate-limiting client IPs

// ── 0. Correlation ID & Timeout ──────────────────────────────────────────────
const { randomUUID } = require('crypto');
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(503).json({ success: false, message: 'Request timeout' });
  });
  next();
});

// ── 1. Helmet (HTTP security headers) ─────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);

// ── 1.5 Compression ────────────────────────────────────────────────────────
app.use(compression());

// ── 2. CORS (strict whitelist) ─────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods    : ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── 3. Body parsing ────────────────────────────────────────────────────────
// IMPORTANT: The Cashfree webhook needs raw body for HMAC signature verification.
// Register it BEFORE express.json() strips the raw body.
const { handleCashfreeWebhook } = require('./controllers/cashfreeController');
app.post(
  '/api/v2/payments/cashfree/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Preserve the raw body string for signature verification, then parse JSON for handler
    req.rawBody = req.body.toString('utf8');
    try { req.body = JSON.parse(req.rawBody); } catch { req.body = {}; }
    next();
  },
  handleCashfreeWebhook
);

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

// ── 7.5 Concurrency protection for burst traffic ─────────────────────────
const concurrencyLimiter = createConcurrencyLimiter({ maxConcurrent: 50 });
app.use('/api', concurrencyLimiter);

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
app.use('/api/v2/wallet',     walletRoutes);
app.use('/api/v2/admin',      walletAdminRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/owner-requests', ownerRequestRoutes);
app.use('/api/v2/notifications', notificationRoutes);

// ── 10. Contact form ────────────────────────────────────────────────────
const contactRoutes = require('./routes/contactRoutes');
app.use('/api/contact', contactRoutes);

// ── 11. Account Deletion ─────────────────────────────────────────────────
const accountDeletionRoutes = require('./routes/accountDeletionRoutes');
app.use('/api/account/delete', accountDeletionRoutes);

// ── 12. Public pages (privacy policy, terms) ─────────────────────────────
const privacyRoutes = require('./routes/privacyRoutes');
app.use('/privacy', privacyRoutes);
app.use('/terms', privacyRoutes); // Same route for now

// ── 12. 404 + Global error handler ────────────────────────────────────────
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
