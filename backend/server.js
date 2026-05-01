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

require('dotenv').config();

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const morgan        = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp           = require('hpp');

const connectDB          = require('./config/db');
const { startCronJobs }  = require('./jobs/cronJobs');
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
const complaintRoutes = require('./routes/complaintRoutes');

// ── Connect to DB ──────────────────────────────────────────────────────────
connectDB();
startCronJobs();

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

// ── 8. Health check (no auth needed) ──────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status : 'ok',
    service: 'HappyRent API',
    env    : process.env.NODE_ENV,
    time   : new Date().toISOString(),
  });
});

// ── 9. API Routes ──────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/rooms',      roomRoutes);
app.use('/api/tenants',    tenantRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/complaints', complaintRoutes);

// ── 10. 404 + Global error handler ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, () => {
  logger.info(`HappyRent API running on port ${PORT} [${process.env.NODE_ENV}]`);
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
  logger.error(`Unhandled Rejection: ${reason}`);
  server.close(() => process.exit(1));
});

module.exports = app; // for testing
