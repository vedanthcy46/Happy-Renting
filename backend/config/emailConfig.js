const { Resend } = require('resend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

/**
 * emailConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Initializes the Resend API client for reliable HTTP-based email delivery.
 */

if (!process.env.RESEND_API_KEY) {
  console.warn('[EMAIL CONFIG WARNING] RESEND_API_KEY is missing from .env');
}

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = resend;
