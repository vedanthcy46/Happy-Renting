'use strict';

const nodemailer = require('nodemailer');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 20000, // 20 seconds for cloud environments
  greetingTimeout: 20000,
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
