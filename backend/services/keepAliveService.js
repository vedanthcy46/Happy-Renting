'use strict';

const logger = require('../config/logger');

/**
 * Keep-Alive Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Prevents the application from sleeping on free hosting tiers (like Render).
 * 
 * Features:
 *  1. Internal fallback scheduler using fetch.
 *  2. Configurable intervals and target URL.
 *  3. Exponential backoff for retries on failure.
 *  4. Jitter to prevent synchronized ping storms.
 *  5. Survives application restarts.
 */

let intervalId = null;

/**
 * Perform a lightweight health ping with retry logic.
 */
const pingHealth = async (url, retryCount = 0) => {
  const maxRetries = 3;
  const backoffDelays = [5000, 15000, 30000]; // 5s, 15s, 30s

  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'User-Agent': 'HappyRenting-KeepAlive/1.0' },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (response.ok) {
      logger.info(`[KEEP-ALIVE] Ping successful: ${url} (Status: ${response.status})`);
    } else {
      throw new Error(`Ping failed with status: ${response.status}`);
    }
  } catch (error) {
    logger.warn(`[KEEP-ALIVE] Ping failed (Attempt ${retryCount + 1}): ${error.message}`);

    if (retryCount < maxRetries) {
      const delay = backoffDelays[retryCount];
      logger.info(`[KEEP-ALIVE] Retrying in ${delay / 1000}s...`);
      setTimeout(() => pingHealth(url, retryCount + 1), delay);
    } else {
      logger.error(`[KEEP-ALIVE] Max retries reached for ${url}. Will try again in the next cycle.`);
    }
  }
};

/**
 * Initialize the keep-alive scheduler.
 */
const initKeepAlive = () => {
  const enabled = process.env.KEEP_ALIVE_ENABLED === 'true';
  const url = process.env.KEEP_ALIVE_URL;
  const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || 300000; // Default 5 mins

  if (!enabled) {
    logger.info('[KEEP-ALIVE] Internal keep-alive is disabled.');
    return;
  }

  if (!url) {
    logger.warn('[KEEP-ALIVE] KEEP_ALIVE_URL is not defined. Keep-alive will not start.');
    return;
  }

  // Prevent duplicate intervals
  if (intervalId) {
    clearInterval(intervalId);
  }

  // Add jitter (0-30s) to the first ping to avoid traffic storms after a deployment
  const jitter = Math.floor(Math.random() * 30000);
  
  logger.info(`[KEEP-ALIVE] Internal scheduler initialized. Pinging ${url} every ${intervalMs / 60000}m (Initial jitter: ${jitter / 1000}s)`);

  setTimeout(() => {
    // Initial ping
    pingHealth(url);

    // Set recurring interval
    intervalId = setInterval(() => pingHealth(url), intervalMs);
  }, jitter);
};

module.exports = { initKeepAlive };
