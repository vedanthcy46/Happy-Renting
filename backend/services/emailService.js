'use strict';

const resend = require('../config/emailConfig');
const logger      = require('../config/logger');

/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized service for sending automated email notifications via Resend API.
 */

const WEBSITE_URL = (process.env.CLIENT_URL || 'https://happyrenting.netlify.app').replace(/\/$/, '');

const sendEmail = async (to, subject, html) => {
  try {
    if (!to) {
      logger.warn(`[EMAIL SKIP] No recipient address provided for subject: ${subject}`);
      return;
    }

    // Production-ready: Use the verified domain email address
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'support@happyrenting.co.in';
    const replyToAddress = process.env.ADMIN_EMAIL || 'vedanthh46@gmail.com';

    const { data, error } = await resend.emails.send({
      from: `Happy Renting <${fromAddress}>`,
      to: [to],
      reply_to: replyToAddress,
      subject,
      html,
    });

    if (error) {
      logger.error(`[EMAIL ERROR] Resend failed for ${to}: ${error.message}`);
      return;
    }

    logger.info(`[EMAIL SENT] to=${to} subject="${subject}" id=${data.id}`);
  } catch (err) {
    logger.error(`[EMAIL ERROR] failed to send to=${to}: ${err.message}`);
  }
};

const getFooter = () => `
  <p style="color: #94a3b8; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; margin-top: 30px;">
    This is an automated message from Happy Renting.<br/>
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
  const subject = `Payment Proof Uploaded - ${tenant.name}`;
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
      ${getFooter()}
    </div>
  `;
  await sendEmail(owner.email, subject, html);
};

// ── 3. Payment Verified (To Tenant) ──────────────────────────────────────────
const sendPaymentStatusNotification = async (tenantUser, payment, property, room, owner) => {
  const isPaid = payment.status === 'paid';
  const subject = isPaid ? `Rent Payment Verified - ${payment.month}` : `Rent Payment Issue - ${payment.month}`;
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
      ${getFooter()}
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
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
      <p><strong>Amount Due:</strong> ₹${payment.amount.toLocaleString()}</p>
      <p><strong>Due Date:</strong> ${new Date(payment.dueDate).toLocaleDateString()}</p>
      <p><strong>Property:</strong> ${property.name}</p>
      <p><strong>Room:</strong> ${room.roomNumber}</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      ${getButton('Pay Rent Now')}
      ${getFooter()}
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

// ── 5. Overdue Alert (To Tenant) ─────────────────────────────────────────────
const sendOverdueAlert = async (tenantUser, payment, property, room, owner) => {
  const subject = `URGENT: Rent Payment Overdue - ${payment.month}`;
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
      ${getFooter()}
    </div>
  `;
  await sendEmail(tenantUser.email, subject, html);
};

// ── 6. Password Change Notification ──────────────────────────────────────────
const sendPasswordChangeNotification = async (user) => {
  const subject = `Security Alert: Password Changed`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #2563eb;">Security Update</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>The password for <strong>${user.email}</strong> was changed at <strong>${new Date().toLocaleString()}</strong>.</p>
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
  await sendEmail(request.email, subject, html);
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
  await sendEmail(request.email, subject, html);
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
  await sendEmail(adminEmail, subject, html);
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
        This link will expire in 30 minutes. If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="color: #2563eb; font-size: 12px; word-break: break-all;">
        ${verificationUrl}
      </p>

      ${getFooter()}
    </div>
  `;
  await sendEmail(user.email, subject, html);
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
  sendRequestRejected,
  sendAdminNewRequestAlert,
  sendTenantWelcome,
  sendVerificationEmail,
};
