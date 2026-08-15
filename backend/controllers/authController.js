'use strict';

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { body } = require('express-validator');
const User   = require('../models/User');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

const OTP = require('../models/OTP');

// ── Validation chains ──────────────────────────────────────────────────────
const loginValidation = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password too long'),
];

const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 characters')
    .escape(),
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('role')
    .optional()
    .isIn(['owner', 'tenant']).withMessage('Invalid role'),
];

// ── Helpers ────────────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { 
      id: user._id, 
      role: user.role, 
      ownerId: user.ownerId, 
      isActive: user.isActive 
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ── POST /api/auth/login ───────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Explicitly select password (select:false in schema)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been disabled by an Administrator. Please contact support.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Send Login Alert if enabled
    if (!user.notificationPreferences || user.notificationPreferences.loginAlerts) {
      const ip = req.ip || req.connection.remoteAddress;
      const device = req.headers['user-agent'];
      await emailService.sendLoginAlertEmail(user, ip, device).catch(() => null);
    }

    const token = signToken(user);

    logger.info(`User logged in: ${user._id} role=${user.role}`);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id     : user._id,
        name    : user.name,
        email   : user.email,
        role    : user.role,
        roles   : user.roles.length > 0 ? user.roles : [user.role],
        ownerId : user.ownerId,
        mustChangePassword: user.mustChangePassword,
        emailVerified: user.emailVerified,
        preferredLanguage: user.preferredLanguage || 'en',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/register ────────────────────────────────────────────────
// Only superadmin can create owners; owners can create tenants
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, ownerId, verificationToken } = req.body;

    const callerRole = req.user?.role;

    // Role creation rules
    if (role === 'owner' && callerRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can create owner accounts.',
      });
    }
    if (role === 'tenant' && !['superadmin', 'owner'].includes(callerRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only owners can create tenant accounts.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Verify email OTP if verificationToken is provided
    if (verificationToken) {
      const verifiedEntry = await OTP.findOne({ email, type: 'verified' });
      if (!verifiedEntry || verifiedEntry.value !== verificationToken) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification. Please verify your email again.' });
      }
      await OTP.deleteOne({ _id: verifiedEntry._id });
    } else {
      return res.status(400).json({ success: false, message: 'Email verification is required.' });
    }

    const userData = {
      name,
      email,
      password,
      role: role || 'tenant',
      emailVerified: true,
    };

    // Tenants created by an owner are scoped to that owner
    if (role === 'tenant' && callerRole === 'owner') {
      userData.ownerId = req.user._id;
    } else if (ownerId) {
      userData.ownerId = ownerId;
    }

    // Force password change if created by others
    if (callerRole) {
      userData.mustChangePassword = true;
    }

    const user = await User.create(userData);

    // Send login credentials so the user knows their password
    if (role === 'tenant') {
      try {
        const ownerName = req.user?.name || 'Your landlord';
        await emailService.sendEmail(
          user.email,
          `Your Happy Renting Login Credentials`,
          `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #2563eb;">
            <h2 style="color: #1e293b;">Welcome to Happy Renting!</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>${ownerName} has created your account. Use the credentials below to log in.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 0; font-weight: bold; color: #1e293b;">Your Login Credentials:</p>
              <p style="margin: 5px 0 0; color: #475569;"><strong>Email:</strong> ${user.email}</p>
              <p style="margin: 5px 0 0; color: #475569;"><strong>Password:</strong> <code style="background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">${password}</code></p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #ef4444;">* You will be asked to change this password on your first login.</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Login Now
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; margin-top: 30px;">
              This is an automated message from Happy Renting.<br/>
              For support, contact us at <a href="mailto:support@happyrenting.co.in" style="color: #2563eb; text-decoration: none;">support@happyrenting.co.in</a>
            </p>
          </div>
          `
        );
      } catch (e) {
        logger.error(`Credentials email failed: ${e.message}`);
      }
    }

    const token = signToken(user);

    logger.info(`[AUTH] New user registered: ${user._id} role=${user.role} by=${req.user?._id}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        _id    : user._id,
        name   : user.name,
        email  : user.email,
        role   : user.role,
        ownerId: user.ownerId,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ───────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/change-password ─────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    // Send security email
    await emailService.sendPasswordChangeNotification(user);

    logger.info(`Password changed for user: ${user._id}`);
    res.status(200).json({ 
      success: true, 
      message: 'Password changed successfully.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ownerId: user.ownerId,
        mustChangePassword: user.mustChangePassword,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/verify-email ──────────────────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    // 1. Find user with this token (including those with expired tokens to give better feedback)
    const user = await User.findOne({ emailVerificationToken: token }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid verification link.' });
    }

    // 2. Already verified?
    if (user.emailVerified) {
      return res.status(200).json({ success: true, message: 'Email is already verified. You can login.' });
    }

    // 3. Check expiry
    if (user.emailVerificationExpires && user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification link has expired. Please request a new one.' });
    }

    // 4. Activate account
    user.emailVerified = true;
    
    await user.save({ validateBeforeSave: false });

    logger.info(`[VERIFY SUCCESS] user=${user._id} email=${user.email}`);
    res.status(200).json({ 
      success: true, 
      message: 'Email verified successfully! You can now log in to your account.' 
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/resend-verification ───────────────────────────────────
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.emailVerified) return res.status(400).json({ success: false, message: 'Email is already verified.' });

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save({ validateBeforeSave: false });

    await emailService.sendVerificationEmail(user, verificationToken);

    res.status(200).json({ success: true, message: 'Verification email resent.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/forgot-password ───────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with that email address.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.save({ validateBeforeSave: false });

    await emailService.sendPasswordResetEmail(user, resetToken);

    res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/reset-password ────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await emailService.sendPasswordChangeNotification(user);

    res.status(200).json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/send-otp ────────────────────────────────────────────────
const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

    const activeOtp = await OTP.findOne({
      email: normalizedEmail,
      type: 'otp',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (activeOtp) {
      logger.warn(`[OTP] Suppressed duplicate email verification send for ${normalizedEmail}`);
      return res.status(429).json({
        success: false,
        message: 'A verification code was already sent to this email. Please use it or wait before requesting another one.'
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    // Upsert the OTP in the database
    await OTP.findOneAndUpdate(
      { email: normalizedEmail, type: 'otp' },
      { value: otp, expiresAt },
      { upsert: true, new: true }
    );

    await emailService.sendEmail(
      normalizedEmail,
      'Your Email Verification OTP',
      `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; border-top: 4px solid #2563eb;">
        <h2 style="color: #1e293b;">Email Verification</h2>
        <p>Use the OTP below to verify your email address:</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #2563eb;">
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0;">${otp}</p>
        </div>
        <p style="color: #64748b;">This OTP expires in <strong>5 minutes</strong>.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated message from Happy Renting.</p>
      </div>
      `
    );

    logger.info(`[OTP] Sent verification code to ${normalizedEmail}`);
    res.status(200).json({ success: true, message: 'OTP sent to email.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/verify-otp ──────────────────────────────────────────────
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required.' });

    const entry = await OTP.findOne({ email, type: 'otp' });
    if (!entry) return res.status(400).json({ success: false, message: 'No OTP found or OTP has expired. Request a new one.' });
    if (entry.value !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    await OTP.deleteOne({ _id: entry._id });
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    await OTP.findOneAndUpdate(
      { email, type: 'verified' },
      { value: verificationToken, expiresAt },
      { upsert: true, new: true }
    );

    logger.info(`[OTP] Email verified: ${email}`);
    res.status(200).json({ success: true, message: 'Email verified successfully.', verificationToken });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  login, register, getMe, changePassword, 
  verifyEmail, resendVerification,
  forgotPassword, resetPassword,
  sendOtp, verifyOtp,
  loginValidation, registerValidation 
};
