'use strict';

const resend = require('../config/emailConfig');
const logger      = require('../config/logger');

/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized service for sending automated email notifications via Resend API.
 */

const NotificationQueue = require('../models/NotificationQueue');

const WEBSITE_URL = (process.env.CLIENT_URL || 'https://happyrenting.netlify.app').replace(/\/$/, '');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Immediate Resilient Email Sending ─────────────────────────────
const sendEmail = async (to, subject, html, attachments = [], retryCount = 0) => {
  try {
    if (!to) {
      logger.warn(`[EMAIL SKIP] No recipient address provided for subject: ${subject}`);
      return;
    }

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'notifications@happyrenting.co.in';
    const replyToAddress = process.env.ADMIN_EMAIL || 'support@happyrenting.co.in';

    const payload = {
      from: `Happy Renting <${fromAddress}>`,
      to: [to],
      reply_to: replyToAddress,
      subject,
      html,
    };

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      // Handle rate limits (429) transparently
      if (
        (error.statusCode === 429 || error.name === 'rate_limit_exceeded' || error.message?.includes('limit')) &&
        retryCount < 3
      ) {
        const backoffDelay = (retryCount + 1) * 1000 + Math.random() * 500;
        logger.warn(`[EMAIL RATE LIMIT] Resend rate limit hit for ${to}. Retrying in ${Math.round(backoffDelay)}ms...`);
        await sleep(backoffDelay);
        return sendEmail(to, subject, html, attachments, retryCount + 1);
      }

      logger.error(`[EMAIL ERROR] Resend failed for ${to}. Error: ${JSON.stringify(error)}`);
      throw new Error(`Resend failed: ${error.message || JSON.stringify(error)}`);
    }

    logger.info(`[EMAIL SENT] to=${to} subject="${subject}" id=${data.id}`);
  } catch (err) {
    if (retryCount < 3) {
      const backoffDelay = (retryCount + 1) * 1000 + Math.random() * 500;
      logger.warn(`[EMAIL ERROR RETRY] Network error for ${to}: ${err.message}. Retrying in ${Math.round(backoffDelay)}ms...`);
      await sleep(backoffDelay);
      return sendEmail(to, subject, html, attachments, retryCount + 1);
    }
    logger.error(`[EMAIL ERROR] failed to send to=${to}: ${err.message}`);
    throw err;
  }
};

// ── Queued Email Sending (For Reminders/Receipts) ───────────────────────────
const queueEmail = async (to, subject, html, type = 'alert') => {
  try {
    if (!to) {
      logger.warn(`[QUEUE SKIP] No recipient address provided for subject: ${subject}`);
      return;
    }
    await NotificationQueue.create({
      to,
      subject,
      body: html,
      type
    });
    logger.info(`[QUEUE ADDED] to=${to} subject="${subject}"`);
  } catch (err) {
    logger.error(`[QUEUE ERROR] failed to enqueue email to=${to}: ${err.message}`);
  }
};

const formatIST = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatDateOnly = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getFooter = () => `
  <p style="color: #94a3b8; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; margin-top: 30px;">
    This is an automated message from Happy Renting.<br/>
    Sent at: ${formatIST(new Date())} IST<br/>
    For support, contact us at <a href="mailto:support@happyrenting.co.in" style="color: #2563eb; text-decoration: none;">support@happyrenting.co.in</a>
  </p>
`;

const getButton = (text = 'Open Dashboard', url = WEBSITE_URL) => `
  <div style="margin: 30px 0; text-align: center;">
    <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${text}</a>
  </div>
`;

// ── New: Complaint Resolved Notification ────────────────────────────────────
const sendComplaintResolvedNotification = async (tenantUser, complaint, property, room) => {
  const subject = `Complaint Resolved: ${complaint.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #16a34a;">
      <h2 style="color: #16a34a;">Issue Resolved</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>Your complaint regarding <strong>"${complaint.title}"</strong> has been marked as <strong>RESOLVED</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      ${complaint.resolutionNotes ? `
        <div style="margin: 20px 0; padding: 15px; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px;">
          <p style="margin: 0; color: #166534; font-size: 14px;"><strong>Resolution Notes:</strong> ${complaint.resolutionNotes}</p>
        </div>
      ` : ''}
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton()}
      ${getFooter()}
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

// ── 1. Complaint Raised (To Owner) ───────────────────────────────────────────
const sendComplaintNotification = async (owner, tenant, complaint, property, room) => {
  const subject = `New Complaint Raised: ${complaint.title}`;
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
      ${getFooter()}
    </div>
  `;
  await sendEmail(owner.email, subject, html);
};

// ── 2. Payment Proof Uploaded (To Owner) ─────────────────────────────────────
const sendPaymentProofNotification = async (owner, tenant, payment, property, room) => {
  if (owner.notificationPreferences?.proofUploadEmails === false) {
    return;
  }

  const subject = `Payment Proof Uploaded - ${tenant.name}`;
  const displayMonth = payment.month || (payment.rentRecordId && payment.rentRecordId.month) || 'Current Month';
  const displayMethod = (payment.method || payment.paymentMethod || 'other').toUpperCase();
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Payment Proof Received</h2>
      <p>Hello <strong>${owner.name}</strong>,</p>
      <p>Tenant <strong>${tenant.name}</strong> has uploaded a payment proof for <strong>${displayMonth}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Amount:</strong> ₹${payment.amount.toLocaleString()}</p>
      <p><strong>Method:</strong> ${displayMethod}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Verify Payment')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(owner.email, subject, html, 'alert');
};

// ── 3. Payment Verified (To Tenant) ──────────────────────────────────────────
const sendPaymentStatusNotification = async (tenantUser, payment, property, room, owner) => {
  const isPaid = payment.status === 'paid' || payment.status === 'completed';
  const displayMonth = payment.month || (payment.rentRecordId && payment.rentRecordId.month) || 'Current Month';
  const displayStatus = payment.status === 'completed' ? 'verified' : payment.status;
  const failureReason = payment.failureReason || payment.statusReason;
  const subject = isPaid ? `Rent Payment Verified - ${displayMonth}` : `Rent Payment Issue - ${displayMonth}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: ${isPaid ? '#16a34a' : '#dc2626'};">${isPaid ? 'Payment Confirmed' : 'Payment Issue'}</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>Your rent payment for <strong>${displayMonth}</strong> has been ${displayStatus}.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Status:</strong> ${displayStatus.toUpperCase()}</p>
      <p><strong>Amount:</strong> ₹${payment.amount.toLocaleString()}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <p><strong>Owner:</strong> ${owner.name}</p>
      ${failureReason ? `
        <div style="margin-top: 20px; padding: 15px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
          <p style="margin: 0; color: #dc2626; font-size: 14px;"><strong>Reason/Note:</strong> ${failureReason}</p>
        </div>
      ` : ''}
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton()}
      ${getFooter()}
    </div>
  `;
  await queueEmail(tenantUser.email, subject, html, 'alert');

  if (owner && owner.notificationPreferences?.paymentReceivedEmails !== false) {
    const ownerSubject = isPaid ? `Payment Verified: ${tenantUser.name} - ${displayMonth}` : `Payment Issue: ${tenantUser.name} - ${displayMonth}`;
    const ownerHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: ${isPaid ? '#16a34a' : '#dc2626'};">${isPaid ? 'Payment Confirmed' : 'Payment Issue'}</h2>
        <p>Hello <strong>${owner.name}</strong>,</p>
        <p>The rent payment from <strong>${tenantUser.name}</strong> for <strong>${displayMonth}</strong> has been ${displayStatus}.</p>
        <p><strong>Amount:</strong> ₹${payment.amount.toLocaleString()}</p>
        <p><strong>Room:</strong> ${room.roomNumber}</p>
        ${failureReason ? `<p style="color: #dc2626;"><strong>Reason:</strong> ${failureReason}</p>` : ''}
        ${getFooter()}
      </div>
    `;
    await queueEmail(owner.email, ownerSubject, ownerHtml, 'alert');
  }
};

// ── 4. Rent Due Reminder (To Tenant) ─────────────────────────────────────────
const sendRentDueReminder = async (tenantUser, payment, property, room, owner) => {
  const subject = `Reminder: Rent Due Tomorrow - ${payment.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #d97706;">Rent Due Tomorrow</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>Friendly reminder that your rent for <strong>${payment.month}</strong> is due tomorrow.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Amount Due:</strong> ₹${(payment.remainingAmount || payment.totalRent).toLocaleString()}</p>
      <p><strong>Due Date:</strong> ${formatDateOnly(payment.dueDate)}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Pay Rent Now')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(tenantUser.email, subject, html, 'reminder');
};

// ── 5. Overdue Alert (To Tenant + Owner) ─────────────────────────────────────────────
const sendOverdueAlert = async (tenantUser, payment, property, room, owner) => {
  const subject = `URGENT: Rent Payment Overdue - ${payment.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #dc2626;">
      <h2 style="color: #dc2626;">Rent Overdue</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>Your rent for <strong>${payment.month}</strong> is now <strong>OVERDUE</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Amount:</strong> ₹${(payment.remainingAmount || payment.totalRent).toLocaleString()}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Clear Overdue Rent')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(tenantUser.email, subject, html, 'alert');

  if (owner && owner.notificationPreferences?.overdueEmails !== false) {
    const ownerSubject = `Tenant Overdue: ${tenantUser.name} - Room ${room.roomNumber}`;
    const ownerHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #dc2626;">
        <h2 style="color: #dc2626;">Tenant Rent Overdue</h2>
        <p>Hello <strong>${owner.name}</strong>,</p>
        <p>Your tenant <strong>${tenantUser.name}</strong> in Room <strong>${room.roomNumber}</strong> is now OVERDUE for <strong>${payment.month}</strong>.</p>
        <p><strong>Amount Due:</strong> ₹${(payment.remainingAmount || payment.totalRent).toLocaleString()}</p>
        <p><strong>Property:</strong> ${property.name}</p>
        ${getFooter()}
      </div>
    `;
    await queueEmail(owner.email, ownerSubject, ownerHtml, 'alert');
  }
};

// ── 6. Password Change Notification ──────────────────────────────────────────
const sendPasswordChangeNotification = async (user) => {
  const subject = `Security Alert: Password Changed`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Security Update</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>The password for <strong>${user.email}</strong> was changed at <strong>${formatIST(new Date())} IST</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p>If you did not perform this change, please contact support or reset your password immediately.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Secure My Account')}
      ${getFooter()}
    </div>
  `;
  await sendEmail(user.email, subject, html);
};

// ── 7. New Tenant Welcome Email ──────────────────────────────────────────────
const sendWelcomeEmail = async (tenantUser, property, room, owner) => {
  const subject = `Welcome to ${property.name}! - Happy Renting`;
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
      ${getFooter()}
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

// ── 8. Owner Request Under Review ───────────────────────────────────────────
const sendRequestUnderReview = async (request) => {
  const subject = `Owner Access Request Received - Happy Renting`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Request Received</h2>
      <p>Hello <strong>${request.name}</strong>,</p>
      <p>Thank you for your interest in joining Happy Renting. Your request for owner access is currently **under review**.</p>
      <p>Our admin team will review your details and contact you at <strong>${request.phone}</strong> for manual verification if needed.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Name:</strong> ${request.name}</p>
      <p><strong>Property:</strong> ${request.propertyName || 'N/A'}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getFooter()}
    </div>
  `;
  await queueEmail(request.email, subject, html, 'alert');
};

// ── 9. Owner Request Approved ───────────────────────────────────────────────
const sendRequestApproved = async (request, password) => {
  const subject = `Welcome to Happy Renting! - Your Account is Ready`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #16a34a;">
      <h2 style="color: #16a34a;">Congratulations!</h2>
      <p>Hello <strong>${request.name}</strong>,</p>
      <p>Your request for owner access has been <strong>APPROVED</strong>. Your account is now active.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Login Email:</strong> ${request.email}</p>
      <p><strong>Temporary Password:</strong> <code style="background: #f4f4f4; padding: 2px 5px;">${password}</code></p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Login to Dashboard')}
      ${getFooter()}
    </div>
  `;
  await sendEmail(request.email, subject, html);
};

// ── 10. Owner Request Rejected ──────────────────────────────────────────────
const sendRequestRejected = async (request, reason) => {
  const subject = `Update Regarding Your Happy Renting Request`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #dc2626;">Request Status</h2>
      <p>Hello <strong>${request.name}</strong>,</p>
      <p>We appreciate your interest in Happy Renting. After careful review, we are unable to approve your request for owner access at this time.</p>
      ${reason ? `
        <div style="margin-top: 20px; padding: 15px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
          <p style="margin: 0; color: #dc2626; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>
        </div>
      ` : ''}
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getFooter()}
    </div>
  `;
  await queueEmail(request.email, subject, html, 'alert');
};

// ── 11. Admin Notification: New Request ────────────────────────────────────
const sendAdminNewRequestAlert = async (request) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'vedanthh46@gmail.com';
  const subject = `New Owner Access Request: ${request.name}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #2563eb;">
      <h2 style="color: #2563eb;">New Request Received</h2>
      <p>Hello Admin,</p>
      <p>A new owner access request has been submitted for review.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Name:</strong> ${request.name}</p>
      <p><strong>Email:</strong> ${request.email}</p>
      <p><strong>Phone:</strong> ${request.phone}</p>
      <p><strong>Property:</strong> ${request.propertyName || 'N/A'}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Review Requests')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(adminEmail, subject, html, 'alert');
};

// ── 12. Tenant Onboarding ───────────────────────────────────────────────────
const sendTenantWelcome = async (tenant, tempPassword, property, room, ownerName, verificationToken = null) => {
  const subject = `Welcome to ${property.name}! Your login details inside.`;
  const verifyUrl = verificationToken ? `${WEBSITE_URL}/verify-email?token=${verificationToken}` : null;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #2563eb;">
      <h2 style="color: #1e293b; margin-top: 0;">Welcome, ${tenant.name}!</h2>
      <p style="color: #475569; line-height: 1.6;">
        Your landlord, <strong>${ownerName}</strong>, has created your account on <strong>Happy Renting</strong>. 
        You can now manage your tenancy, view payments, and raise complaints online.
      </p>
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0; font-weight: bold; color: #1e293b;">Your Login Credentials:</p>
        <p style="margin: 5px 0 0; color: #475569;"><strong>Email:</strong> ${tenant.email}</p>
        <p style="margin: 5px 0 0; color: #475569;"><strong>Temp Password:</strong> <code style="background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">${tempPassword}</code></p>
        <p style="margin: 10px 0 0; font-size: 12px; color: #ef4444;">* You will be asked to change this password on your first login.</p>
      </div>

      ${verifyUrl ? `
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #eff6ff; border-radius: 8px;">
          <p style="margin: 0 0 15px; font-weight: bold; color: #1e3a8a;">Verify your account to get started:</p>
          <a href="${verifyUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email & Login
          </a>
        </div>
      ` : `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${WEBSITE_URL}login" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Login to Happy Renting
          </a>
        </div>
      `}

      <div style="margin: 20px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <p style="margin: 0; font-weight: bold; color: #1e293b;">Tenancy Details:</p>
        <p style="margin: 5px 0 0; color: #475569;"><strong>Property:</strong> ${property.name}</p>
        <p style="margin: 5px 0 0; color: #475569;"><strong>Room:</strong> ${room.roomNumber}</p>
      </div>

      ${getFooter()}
    </div>
  `;
  await sendEmail(tenant.email, subject, html);
};

// ── 13. Email Verification ──────────────────────────────────────────────────
const sendVerificationEmail = async (user, token) => {
  const subject = 'Verify your Happy Renting account';
  const verificationUrl = `${WEBSITE_URL}/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #2563eb;">
      <h2 style="color: #1e293b; margin-top: 0;">Verify your email address</h2>
      <p style="color: #475569; line-height: 1.6;">
        Welcome to Happy Renting, ${user.name}! Please click the button below to verify your email address and activate your account.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Verify Email Address
        </a>
      </div>

      <p style="color: #475569; font-size: 14px;">
        This link will expire in 15 minutes. If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="color: #2563eb; font-size: 12px; word-break: break-all;">
        ${verificationUrl}
      </p>

      ${getFooter()}
    </div>
  `;
  await sendEmail(user.email, subject, html);
};

// ── NEW: Payment Transaction Notification (V2 System) ────────────────────────
const sendPaymentTransactionNotification = async (tenantUser, transaction, rentRecord, property, room, owner) => {
  const subject = `Payment Recorded for ${rentRecord.month} - Happy Renting`;
  const balanceText = rentRecord.remainingAmount > 0
    ? `<p><strong>Remaining Balance:</strong> ₹${rentRecord.remainingAmount.toLocaleString()}</p>`
    : `<p style="color: #16a34a;"><strong>✓ Rent Fully Paid for ${rentRecord.month}</strong></p>`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Payment Received</h2>
      <p>Hello <strong>${tenantUser.name}</strong>,</p>
      <p>We have recorded your payment for <strong>${rentRecord.month}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Amount Paid:</strong> ₹${transaction.amount.toLocaleString()}</p>
      <p><strong>Payment Method:</strong> ${transaction.paymentMethod.toUpperCase()}</p>
      <p><strong>Transaction Date:</strong> ${formatDateOnly(transaction.paymentDate)}</p>
      ${transaction.note ? `<p><strong>Note:</strong> ${transaction.note}</p>` : ''}
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <div style="padding: 15px; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 4px;">
        <p><strong>Total Rent:</strong> ₹${rentRecord.totalRent.toLocaleString()}</p>
        <p><strong>Total Paid:</strong> ₹${rentRecord.totalPaid.toLocaleString()}</p>
        ${balanceText}
      </div>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('View Payment Details')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(tenantUser.email, subject, html, 'receipt');

  if (owner && owner.notificationPreferences?.paymentReceivedEmails !== false) {
    const ownerSubject = `Payment Received: ${tenantUser.name} - Room ${room.roomNumber}`;
    const ownerHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2563eb;">Payment Received</h2>
        <p>Hello <strong>${owner.name}</strong>,</p>
        <p>Tenant <strong>${tenantUser.name}</strong> in Room <strong>${room.roomNumber}</strong> has made a payment of <strong>₹${transaction.amount.toLocaleString()}</strong>.</p>
        <p><strong>Method:</strong> ${transaction.paymentMethod.toUpperCase()}</p>
        <p><strong>Date:</strong> ${formatDateOnly(transaction.paymentDate)}</p>
        <p><strong>Remaining Balance:</strong> ₹${rentRecord.remainingAmount.toLocaleString()}</p>
        ${getFooter()}
      </div>
    `;
    await queueEmail(owner.email, ownerSubject, ownerHtml, 'receipt');
  }
};

// ── Missing V2 Audit Templates ───────────────────────────────────────────────

const sendPasswordResetEmail = async (user, token) => {
  const subject = 'Password Reset Request';
  const resetUrl = `${WEBSITE_URL}/reset-password?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Reset Your Password</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>We received a request to reset your password. This link is valid for 1 hour.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Reset Password', resetUrl)}
      ${getFooter()}
    </div>
  `;
  await sendEmail(user.email, subject, html);
};

const sendLoginAlertEmail = async (user, ipAddress, device) => {
  if (user.notificationPreferences?.loginAlerts === false) {
    return;
  }

  const subject = 'New Login Alert';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">New Login Detected</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>We detected a new login to your Happy Renting account.</p>
      <ul>
        <li><strong>Time:</strong> ${formatIST(new Date())} IST</li>
        <li><strong>IP Address:</strong> ${ipAddress || 'Unknown'}</li>
        <li><strong>Device:</strong> ${device || 'Unknown'}</li>
      </ul>
      <p>If this was you, you can safely ignore this email.</p>
      ${getFooter()}
    </div>
  `;
  await queueEmail(user.email, subject, html, 'alert');
};

const Notification = require('../models/Notification');

const sendOwnerBillingSummaryEmail = async (owner, count, month) => {
  if (owner.notificationPreferences?.billingSummaryEmails === false) return;

  const subject = `Billing Cycle Completed - ${month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #2563eb;">
      <h2 style="color: #2563eb;">Monthly Billing Generated</h2>
      <p>Hello <strong>${owner.name}</strong>,</p>
      <p>The automated billing cycle for <strong>${month}</strong> has been completed.</p>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0; font-size: 16px;">Total Bills Generated: <strong>${count}</strong></p>
      </div>
      <p>Individual notifications have been sent to your tenants. You can review all records in your dashboard.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('View Billing Records')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(owner.email, subject, html, 'alert');
  await Notification.create({ 
    userId: owner._id, 
    title: 'Billing Cycle Completed', 
    message: `Successfully generated ${count} bills for ${month}.`, 
    type: 'billing' 
  }).catch(() => null);
};

const sendBillGeneratedEmail = async ({ user, role, rentRecord, property, room, tenantUser }) => {
  const isOwner = role === 'owner' || role === 'superadmin' || user.role === 'owner' || user.role === 'superadmin';
  const subject = isOwner 
    ? `Rent Bill Generated for Room ${room.roomNumber} - ${rentRecord.month}` 
    : `Rent Bill Generated - ${rentRecord.month}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">New Rent Bill Generated</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>${isOwner 
        ? `A rent bill for your tenant <strong>${tenantUser?.name || 'Tenant'}</strong> in Room ${room.roomNumber} for <strong>${rentRecord.month}</strong> has been generated successfully.` 
        : `Your rent bill for <strong>${rentRecord.month}</strong> has been generated.`}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p><strong>Total Rent:</strong> ₹${rentRecord.totalRent.toLocaleString()}</p>
      <p><strong>Due Date:</strong> ${formatDateOnly(rentRecord.dueDate)}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${!isOwner ? getButton('View & Pay') : getButton('View Details')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(user.email, subject, html, 'alert');
  
  const notifTitle = isOwner ? 'Tenant Bill Generated' : 'Bill Generated';
  const notifMsg = isOwner 
    ? `Bill for Room ${room.roomNumber} (${rentRecord.month}) generated.` 
    : `Your bill for ${rentRecord.month} is generated. Total: ₹${rentRecord.totalRent.toLocaleString()}`;

  await Notification.create({ userId: user._id, title: notifTitle, message: notifMsg, type: 'billing' }).catch(() => null);
};

const sendDueTodayReminderEmail = async (user, rentRecord, property, room) => {
  const subject = `URGENT: Rent Due Today - ${rentRecord.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #f59e0b;">
      <h2 style="color: #f59e0b;">Rent Due Today</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>This is a reminder that your rent of <strong>₹${rentRecord.remainingAmount.toLocaleString()}</strong> for <strong>${rentRecord.month}</strong> is due today.</p>
      ${getButton('Pay Now')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(user.email, subject, html, 'reminder');
  await Notification.create({ userId: user._id, title: 'Rent Due Today', message: `Rent of ₹${rentRecord.remainingAmount.toLocaleString()} is due today.`, type: 'billing' }).catch(() => null);
};

const sendDueSoonReminderEmail = async (user, rentRecord, property, room) => {
  const subject = `Reminder: Rent Due Tomorrow - ${rentRecord.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #3b82f6;">
      <h2 style="color: #3b82f6;">Rent Due Tomorrow</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>This is a friendly reminder that your rent for <strong>${rentRecord.month}</strong> is due tomorrow.</p>
      <p>Amount Due: <strong>₹${rentRecord.remainingAmount.toLocaleString()}</strong></p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Pay Now')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(user.email, subject, html, 'reminder');
  await Notification.create({ userId: user._id, title: 'Rent Due Tomorrow', message: `Rent of ₹${rentRecord.remainingAmount.toLocaleString()} is due tomorrow.`, type: 'billing' }).catch(() => null);
};

const sendTransactionReversalEmail = async (user, transaction, rentRecord, owner) => {
  const subject = `Payment Reversed - ${rentRecord.month}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #ef4444;">
      <h2 style="color: #ef4444;">Payment Reversed</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>A previous payment of <strong>₹${transaction.amount.toLocaleString()}</strong> for ${rentRecord.month} has been reversed by the administrator.</p>
      <p>Your remaining balance is now: <strong>₹${rentRecord.remainingAmount.toLocaleString()}</strong>.</p>
      ${getFooter()}
    </div>
  `;
  await queueEmail(user.email, subject, html, 'alert');
  await Notification.create({ userId: user._id, title: 'Payment Reversed', message: `A payment of ₹${transaction.amount.toLocaleString()} was reversed.`, type: 'alert' }).catch(() => null);

  if (owner && owner.notificationPreferences?.paymentReceivedEmails !== false) {
    const ownerSubject = `Payment Reversed: ${user.name} - ${rentRecord.month}`;
    const ownerHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #ef4444;">
        <h2 style="color: #ef4444;">Tenant Payment Reversed</h2>
        <p>Hello <strong>${owner.name}</strong>,</p>
        <p>A previous payment of <strong>₹${transaction.amount.toLocaleString()}</strong> from <strong>${user.name}</strong> for ${rentRecord.month} has been reversed by the administrator.</p>
        <p>Tenant remaining balance is now: <strong>₹${rentRecord.remainingAmount.toLocaleString()}</strong>.</p>
        ${getFooter()}
      </div>
    `;
    await queueEmail(owner.email, ownerSubject, ownerHtml, 'alert');
  }
};

const sendMoveOutInitiatedEmail = async (user, exitDate, property, room) => {
  const isOwner = user.role === 'owner' || user.role === 'superadmin';

  if (isOwner && user.notificationPreferences?.systemEmails === false) {
    return;
  }

  const subject = isOwner ? `Action Required: Move-Out Requested - ${property.name}` : `Move-Out Confirmed - ${property.name}`;
  const title = isOwner ? 'Tenant Move-Out Scheduled' : 'Move-Out Scheduled';
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">${title}</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>${isOwner 
        ? `A tenant in Room ${room.roomNumber} at ${property.name} has scheduled a move-out for <strong>${formatDateOnly(exitDate)}</strong>. Please review the final settlement once generated.` 
        : `Your move-out from Room ${room.roomNumber} at ${property.name} has been scheduled for <strong>${formatDateOnly(exitDate)}</strong>.`
      }</p>
      ${!isOwner ? `<p>Your final settlement will be calculated up to this date.</p>` : ''}
      ${getFooter()}
    </div>
  `;
  await queueEmail(user.email, subject, html, 'alert');
};

const sendFinalSettlementEmail = async ({ user, role, rentRecord, property, room, tenantUser }) => {
  const isOwner = role === 'owner' || role === 'superadmin' || user.role === 'owner' || user.role === 'superadmin';

  if (isOwner && user.notificationPreferences?.settlementEmails === false) {
    return;
  }

  let statusText = '';
  let subjectBase = '';
  if (rentRecord.remainingAmount > 0) {
    subjectBase = 'Final Settlement Payment Required';
    statusText = 'A final payment is required to close the account.';
  } else if (rentRecord.remainingAmount < 0) {
    subjectBase = 'Final Settlement Refund Available';
    statusText = 'A refund is due for the remaining advance balance.';
  } else {
    subjectBase = 'Move-Out Successfully Closed';
    statusText = 'The account is fully settled with zero balance.';
  }

  const subject = isOwner ? `${subjectBase} - Room ${room.roomNumber} - ${property.name}` : `${subjectBase} - ${property.name}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">${subjectBase}</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>${isOwner 
        ? `The final move-out settlement for your tenant <strong>${tenantUser?.name || 'Tenant'}</strong> in Room ${room.roomNumber} has been generated.` 
        : `Your final move-out settlement for Room ${room.roomNumber} has been generated.`}</p>
      <p style="padding: 10px; background: #f8fafc; border-left: 4px solid #2563eb;"><strong>${statusText}</strong></p>
      <p><strong>Prorated Rent:</strong> ₹${rentRecord.totalRent.toLocaleString()}</p>
      <p><strong>Advance Balance (Refundable):</strong> ₹${rentRecord.advanceBalance.toLocaleString()}</p>
      <p><strong>Net Balance:</strong> ₹${rentRecord.remainingAmount.toLocaleString()}</p>
      ${!isOwner ? getButton('View Settlement') : getButton('View Details')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(user.email, subject, html, 'alert');
  
  const notifTitle = isOwner ? 'Tenant Final Settlement' : 'Final Settlement';
  const notifMsg = isOwner 
    ? `Final settlement for Room ${room.roomNumber} generated. Balance: ₹${rentRecord.remainingAmount.toLocaleString()}` 
    : `Your final settlement is generated. Balance: ₹${rentRecord.remainingAmount.toLocaleString()}`;

  await Notification.create({ userId: user._id, title: notifTitle, message: notifMsg, type: 'billing' }).catch(() => null);
};

const sendSystemFailureAlert = async (type, errorMsg) => {
  const adminEmail = process.env.SYSADMIN_EMAIL || process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const subject = `[URGENT] System Failure: ${type}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #dc2626;">
      <h2 style="color: #dc2626;">System Failure Detected</h2>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>Time:</strong> ${formatIST(new Date())} IST</p>
      <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${errorMsg}</pre>
    </div>
  `;
  await sendEmail(adminEmail, subject, html);
};

const sendDailyDigestEmail = async (owner, summary) => {
  if (owner.notificationPreferences?.dailyDigestEmails === false) return;

  const isSuperAdmin = owner.role === 'superadmin';
  const subject = isSuperAdmin ? `Global Platform Summary - Happy Renting` : `Daily Owner Summary - Happy Renting`;
  const title = isSuperAdmin ? `Global Platform Summary` : `Daily Owner Summary`;
  const intro = isSuperAdmin 
    ? `Here is the daily operational summary across the entire platform:` 
    : `Here is your daily operational summary across your properties:`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">${title}</h2>
      <p>Hello <strong>${owner.name}</strong>,</p>
      <p>${intro}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <ul style="line-height: 1.8; font-size: 16px;">
        <li><strong>Overdue Tenants:</strong> <span style="color: #dc2626; font-weight: bold;">${summary.overdueTenants}</span></li>
        <li><strong>Pending Payments:</strong> <span style="color: #f59e0b; font-weight: bold;">${summary.pendingPayments}</span></li>
        <li><strong>Collections Today:</strong> <span style="color: #16a34a; font-weight: bold;">₹${summary.collectionsToday.toLocaleString()}</span></li>
        <li><strong>Active Move-out Requests:</strong> <strong>${summary.moveOutRequests}</strong></li>
      </ul>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Open Dashboard')}
      ${getFooter()}
    </div>
  `;
  await queueEmail(owner.email, subject, html, 'alert');
};

module.exports = {
  sendComplaintNotification,
  sendComplaintResolvedNotification,
  sendPaymentProofNotification,
  sendPaymentStatusNotification,
  sendRentDueReminder,
  sendOverdueAlert,
  sendPasswordChangeNotification,
  sendWelcomeEmail,
  sendRequestUnderReview,
  sendRequestApproved,
  sendAdminNewRequestAlert,
  sendTenantWelcome,
  sendVerificationEmail,
  sendPaymentTransactionNotification,
  sendPasswordResetEmail,
  sendLoginAlertEmail,
  sendBillGeneratedEmail,
  sendDueTodayReminderEmail,
  sendDueSoonReminderEmail,
  sendTransactionReversalEmail,
  sendMoveOutInitiatedEmail,
  sendFinalSettlementEmail,
  sendOwnerBillingSummaryEmail,
  sendSystemFailureAlert,
  sendDailyDigestEmail,
};

// ── Background Queue Processor ──────────────────────────────────────────────
const processNotificationQueue = async () => {
  try {
    const pendingNotifications = [];
    for (let i = 0; i < 20; i++) {
      const doc = await NotificationQueue.findOneAndUpdate(
        {
          status: { $in: ['pending', 'failed'] },
          nextRetryAt: { $lte: new Date() },
          deadLetter: false
        },
        { $set: { status: 'processing' } },
        { sort: { nextRetryAt: 1 }, new: true }
      );
      if (!doc) break;
      pendingNotifications.push(doc);
    }

    if (pendingNotifications.length === 0) return;

    logger.info(`[QUEUE] Processing ${pendingNotifications.length} emails...`);

    for (const notification of pendingNotifications) {
      try {
        await sendEmail(notification.to, notification.subject, notification.body);
        notification.status = 'sent';
        await notification.save();
      } catch (err) {
        notification.retryCount += 1;
        notification.status = 'failed';
        notification.errorLog = err.message;
        
        const now = new Date();
        if (notification.retryCount === 1) notification.nextRetryAt = new Date(now.getTime() + 1 * 60000); // +1 min
        else if (notification.retryCount === 2) notification.nextRetryAt = new Date(now.getTime() + 5 * 60000); // +5 min
        else if (notification.retryCount === 3) notification.nextRetryAt = new Date(now.getTime() + 15 * 60000); // +15 min
        else if (notification.retryCount === 4) notification.nextRetryAt = new Date(now.getTime() + 60 * 60000); // +60 min
        else {
          notification.deadLetter = true;
          // Send alert to SYSADMIN
          const sysAdminEmail = process.env.SYSADMIN_EMAIL || process.env.ADMIN_EMAIL;
          if (sysAdminEmail) {
             const subject = `[URGENT] Dead Letter Queue Alert`;
             const html = `<p>Failed to deliver email to ${notification.to}.</p><p>Subject: ${notification.subject}</p><p>Error: ${err.message}</p>`;
             sendEmail(sysAdminEmail, subject, html).catch(() => {});
          }
        }
        await notification.save();
      }
    }
  } catch (err) {
    logger.error(`[QUEUE PROCESSOR ERROR] ${err.message}`);
  }
};

module.exports.processNotificationQueue = processNotificationQueue;
