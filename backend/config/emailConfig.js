'use strict';

const nodemailer = require('nodemailer');
const dns = require('dns');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Force IPv4 globally to resolve ENETUNREACH (IPv6) issues on cloud platforms
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Must be an App Password
  },
  family: 4, // Force IPv4 to avoid ENETUNREACH (IPv6 issues)
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

/**
 * verifyTransporter()
 * Checks if the SMTP connection is valid without blocking the main process.
 */
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('[EMAIL CONFIG SUCCESS] SMTP Transporter is ready.');
  } catch (error) {
    console.error('[EMAIL CONFIG ERROR] Transporter verification failed:', error.message);
    // Do not throw or crash; allow the app to run without email if necessary
  }
};

verifyTransporter();

module.exports = transporter;
