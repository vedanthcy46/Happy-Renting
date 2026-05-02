'use strict';

const transporter = require('../config/emailConfig');
const logger      = require('../config/logger');

/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized service for sending automated email notifications.
 */

const WEBSITE_URL = process.env.CLIENT_URL || 'https://happyrenting.netlify.app/';

const sendEmail = async (to, subject, html) => {
  try {
    if (!to) {
      logger.warn(`[EMAIL SKIP] No recipient address provided for subject: ${subject}`);
      return;
    }

    const info = await transporter.sendMail({
      from: `"HappyRent Support" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    logger.info(`[EMAIL SENT] to=${to} subject="${subject}" messageId=${info.messageId}`);
  } catch (err) {
    logger.error(`[EMAIL ERROR] failed to send to=${to}: ${err.message}`);
  }
};

const getButton = (text = 'Open Dashboard') => `
  <div style="margin: 30px 0; text-align: center;">
    <a href="${WEBSITE_URL}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${text}</a>
  </div>
`;

// ── 1. Complaint Raised (To Owner) ───────────────────────────────────────────
const sendComplaintNotification = async (owner, tenant, complaint, property, room) => {
  const subject = `⚠️ New Complaint Raised: ${complaint.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #e11d48;">New Maintenance Request</h2>
      <p>Hello <strong>${owner.name}</strong>,</p>
      <p>A new complaint has been raised by a tenant.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Tenant:</strong> ${tenant.name}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <p><strong>Title:</strong> ${complaint.title}</p>
      <p><strong>Description:</strong> ${complaint.description}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton()}
      <p style="font-size: 12px; color: #666; text-align: center;">Please login to your dashboard to manage this request.</p>
    </div>
  `;
  await sendEmail(owner.email, subject, html);
};

// ── 2. Payment Proof Uploaded (To Owner) ─────────────────────────────────────
const sendPaymentProofNotification = async (owner, tenant, payment, property, room) => {
  const subject = `💰 Payment Proof Uploaded - ${tenant.name}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Payment Proof Received</h2>
      <p>Hello <strong>${owner.name}</strong>,</p>
      <p>Tenant <strong>${tenant.name}</strong> has uploaded a payment proof for <strong>${payment.month}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Amount:</strong> ₹${payment.amount.toLocaleString()}</p>
      <p><strong>Method:</strong> ${payment.method.toUpperCase()}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Verify Payment')}
      <p style="font-size: 12px; color: #666; text-align: center;">Please verify the payment in your dashboard.</p>
    </div>
  `;
  await sendEmail(owner.email, subject, html);
};

// ── 3. Payment Verified (To Tenant) ──────────────────────────────────────────
const sendPaymentStatusNotification = async (tenantUser, payment, property, room, owner) => {
  const isPaid = payment.status === 'paid';
  const subject = isPaid ? `✅ Rent Payment Verified - ${payment.month}` : `❌ Rent Payment Rejected - ${payment.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: ${isPaid ? '#16a34a' : '#dc2626'};">${isPaid ? 'Payment Confirmed' : 'Payment Issue'}</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>Your rent payment for <strong>${payment.month}</strong> has been ${payment.status}.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Status:</strong> ${payment.status.toUpperCase()}</p>
      <p><strong>Amount:</strong> ₹${payment.amount.toLocaleString()}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <p><strong>Owner:</strong> ${owner.name}</p>
      ${payment.failureReason ? `
        <div style="margin-top: 20px; padding: 15px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
          <p style="margin: 0; color: #dc2626; font-size: 14px;"><strong>Reason:</strong> ${payment.failureReason}</p>
        </div>
      ` : ''}
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton()}
      <p style="font-size: 12px; color: #666; text-align: center;">Thank you for using HappyRent.</p>
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

// ── 4. Rent Due Reminder (To Tenant) ─────────────────────────────────────────
const sendRentDueReminder = async (tenantUser, payment, property, room, owner) => {
  const subject = `⏳ Reminder: Rent Due Tomorrow - ${payment.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #d97706;">Rent Due Tomorrow</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>Friendly reminder that your rent for <strong>${payment.month}</strong> is due tomorrow.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Amount Due:</strong> ₹${payment.amount.toLocaleString()}</p>
      <p><strong>Due Date:</strong> ${new Date(payment.dueDate).toLocaleDateString()}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Pay Rent Now')}
      <p style="font-size: 12px; color: #666; text-align: center;">Please ensure timely payment to avoid late fees.</p>
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

// ── 5. Overdue Alert (To Tenant) ─────────────────────────────────────────────
const sendOverdueAlert = async (tenantUser, payment, property, room, owner) => {
  const subject = `🚨 URGENT: Rent Payment Overdue - ${payment.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #dc2626;">
      <h2 style="color: #dc2626;">Rent Overdue</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>Your rent for <strong>${payment.month}</strong> is now <strong>OVERDUE</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Amount:</strong> ₹${payment.amount.toLocaleString()}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Clear Overdue Rent')}
      <p style="font-size: 12px; color: #666; text-align: center;">Please make the payment immediately to maintain your good standing.</p>
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

// ── 6. Password Change Notification ──────────────────────────────────────────
const sendPasswordChangeNotification = async (user) => {
  const subject = `🔒 Security Alert: Password Changed`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Security Update</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>The password for <strong>${user.email}</strong> was changed at <strong>${new Date().toLocaleString()}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p>If you did not perform this change, please contact support or reset your password immediately.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Secure My Account')}
    </div>
  `;
  await sendEmail(user.email, subject, html);
};

// ── 7. New Tenant Welcome Email ──────────────────────────────────────────────
const sendWelcomeEmail = async (tenantUser, property, room, owner) => {
  const subject = `🏠 Welcome to ${property.name}! - HappyRent`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Welcome to Your New Home!</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>We are excited to have you at <strong>${property.name}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room Number:</strong> ${room.roomNumber}</p>
      <p><strong>Owner:</strong> ${owner.name}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Get Started')}
      <p style="font-size: 12px; color: #666; text-align: center;">Welcome to the family!</p>
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

module.exports = {
  sendComplaintNotification,
  sendPaymentProofNotification,
  sendPaymentStatusNotification,
  sendRentDueReminder,
  sendOverdueAlert,
  sendPasswordChangeNotification,
  sendWelcomeEmail,
};
