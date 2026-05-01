'use strict';

const rateLimit = require('express-rate-limit');
const logger    = require('../config/logger');

/**
 * authLimiter
 * Strict rate limit for auth endpoints (login, register).
 * DISABLED for development.
 */
const authLimiter = (req, res, next) => next();

/**
 * apiLimiter
 * General API limit.
 * DISABLED for development.
 */
const apiLimiter = (req, res, next) => next();

module.exports = { authLimiter, apiLimiter };
