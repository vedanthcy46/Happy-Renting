'use strict';

const router = require('express').Router();
const emailService = require('../services/emailService');
const logger = require('../config/logger');

router.post('/', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2 style="color: #10b981;">New Contact Form Submission</h2>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Name</td><td style="padding: 8px 0;">${name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Subject</td><td style="padding: 8px 0;">${subject}</td></tr>
        </table>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #555; line-height: 1.6;">${message}</p>
      </div>
    `;

    await emailService.sendEmail(
      process.env.ADMIN_EMAIL || 'support@happyrenting.co.in',
      `[Contact] ${subject}`,
      html
    );

    logger.info(`[CONTACT] Message from ${name} <${email}>: ${subject}`);

    res.status(200).json({ success: true, message: 'Message sent. We will get back to you within 24 hours.' });
  } catch (err) {
    logger.error(`[CONTACT] Failed to send message: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again later.' });
  }
});

module.exports = router;
