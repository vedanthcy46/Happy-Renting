'use strict';

const jwt    = require('jsonwebtoken');
const { body } = require('express-validator');
const User   = require('../models/User');
const logger = require('../config/logger');

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
const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── POST /api/auth/login ───────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Explicitly select password (select:false in schema)
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      // Use identical message to prevent user enumeration
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
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

    const token = signToken(user._id, user.role);

    logger.info(`User logged in: ${user._id} role=${user.role}`);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id     : user._id,
        name    : user.name,
        email   : user.email,
        role    : user.role,
        ownerId : user.ownerId,
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
    const { name, email, password, role, ownerId } = req.body;

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

    const userData = {
      name,
      email,
      password,
      role: role || 'tenant',
    };

    // Tenants created by an owner are scoped to that owner
    if (role === 'tenant' && callerRole === 'owner') {
      userData.ownerId = req.user._id;
    } else if (ownerId) {
      userData.ownerId = ownerId;
    }

    const user = await User.create(userData);
    const token = signToken(user._id, user.role);

    logger.info(`New user created: ${user._id} role=${user.role} by=${req.user?._id}`);

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

const emailService = require('../services/emailService');

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
    await user.save();

    // Send security email
    await emailService.sendPasswordChangeNotification(user);

    logger.info(`Password changed for user: ${user._id}`);
    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, getMe, changePassword, loginValidation, registerValidation };
