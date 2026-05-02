'use strict';

const nodemailer = require('nodemailer');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // This often helps with ENETUNREACH and other connection issues
    rejectUnauthorized: true,
  },
  connectionTimeout: 10000, // 10 seconds
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('[EMAIL CONFIG ERROR] Transporter verification failed:', error);
  } else {
    console.log('[EMAIL CONFIG SUCCESS] Server is ready to take our messages');
  }
});

module.exports = transporter;
