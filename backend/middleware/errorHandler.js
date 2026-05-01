'use strict';

const logger = require('../config/logger');

/**
 * Global error handler — must be the LAST middleware added to Express.
 * Hides implementation details (stack traces) in production.
 */
const errorHandler = (err, req, res, _next) => {
  // Log full details server-side
  logger.error(`${err.name}: ${err.message}\n${err.stack}`);

  // Mongoose duplicate key
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue);
    const fieldName = fields.length > 1 ? fields.join(' and ') : fields[0];
    return res.status(409).json({
      success: false,
      message: `A record with this ${fieldName} already exists.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors : messages,
    });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // JWT errors — should be caught in auth middleware but handled here as fallback
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please log in again.',
    });
  }

  // Default
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : err.message,
    // Show stack in dev only
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * notFound
 * 404 handler for unmatched routes.
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFound };
