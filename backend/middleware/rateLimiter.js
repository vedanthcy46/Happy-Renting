'use strict';

const rateLimit = require('express-rate-limit');
const logger    = require('../config/logger');

/**
 * authLimiter
 * Strict rate limit for auth endpoints (login, register).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * apiLimiter
 * General API limit.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };
