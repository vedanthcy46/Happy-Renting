'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

/**
 * GET /health
 * Lightweight health check endpoint for the Happy Renting API.
 * Provides basic service status and optionally detailed system metrics.
 */
router.get('/', (req, res) => {
  const { detailed, key } = req.query;

  // Basic health metadata
  const healthData = {
    status: 'ok',
    service: 'Happy Renting API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: Math.floor(process.uptime()), // Uptime in seconds
  };

  // Detailed metrics (Protected by optional API Key)
  const isAuthorized = !process.env.HEALTH_API_KEY || key === process.env.HEALTH_API_KEY;

  if (detailed === 'true') {
    if (!isAuthorized) {
      logger.warn(`Unauthorized detailed health check attempt from IP: ${req.ip}`);
      return res.status(403).json({ 
        status: 'error', 
        message: 'Forbidden: Valid API key required for detailed metrics.' 
      });
    }

    // Add sensitive metadata only for authorized requests
    healthData.details = {
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuUsage: process.cpuUsage(),
    };
  }

  res.status(200).json(healthData);
});

module.exports = router;
