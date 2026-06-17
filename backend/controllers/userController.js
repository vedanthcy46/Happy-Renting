'use strict';

const { body } = require('express-validator');
const User     = require('../models/User');
const Tenant   = require('../models/Tenant');
const Property = require('../models/Property');
const ActivityLog = require('../models/ActivityLog');
const Room       = require('../models/Room');
const Payment    = require('../models/Payment');
const Complaint  = require('../models/Complaint');
const CoOccupant = require('../models/CoOccupant');
const emailService = require('../services/emailService');
const logger   = require('../config/logger');

// ── Validation ─────────────────────────────────────────────────────────────
const createUserValidation = [
  body('name').trim().isLength({ min: 2, max: 60 }).escape().withMessage('Name must be 2-60 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('role').isIn(['owner', 'tenant']).withMessage('Role must be owner or tenant'),
];

// ── GET /api/users ─────────────────────────────────────────────────────────
// superadmin: all users | owner: their tenants only
const getUsers = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'owner') {
      filter.ownerId = req.user._id;
      filter.role    = 'tenant';
    } else if (req.user.role === 'superadmin') {
      if (req.query.role) filter.role = req.query.role;
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, users });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/admin/stats (Super Admin only) ──────────────────────────
const getAdminStats = async (req, res, next) => {
  try {
    const [ownersCount, propertiesCount, tenantsCount] = await Promise.all([
      User.countDocuments({ role: 'owner' }),
      Property.countDocuments({}),
      Tenant.countDocuments({ status: 'active' }),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalOwners     : ownersCount,
        totalProperties  : propertiesCount,
        totalTenants     : tenantsCount,
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/admin/mapping (Super Admin only) ────────────────────────
const getOwnerPropertyMapping = async (req, res, next) => {
  try {
    const owners = await User.find({ role: 'owner' }).select('name email');
    
    const mapping = await Promise.all(owners.map(async (owner) => {
      const [propCount, tenantCount] = await Promise.all([
        Property.countDocuments({ ownerId: owner._id }),
        Tenant.countDocuments({ ownerId: owner._id, status: 'active' }),
      ]);
      
      return {
        _id           : owner._id,
        name          : owner.name,
        email         : owner.email,
        propertyCount : propCount,
        tenantCount   : tenantCount
      };
    }));

    res.status(200).json({ success: true, mapping });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/:id ─────────────────────────────────────────────────────
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    // Owners can only view their own tenants
    if (req.user.role === 'owner' && String(user.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
// ── GET /api/users/profile ─────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/users/profile ───────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, email, upiId, upiNumber, bankDetails, upiDetails } = req.body;
    const user = await User.findById(req.user._id);

    if (name)  user.name  = name;
    if (phone) user.phone = phone;
    if (upiId !== undefined)   user.upiId   = upiId;
    if (upiNumber !== undefined) user.upiNumber = upiNumber;

    if (upiDetails !== undefined && typeof upiDetails === 'object') {
      user.upiDetails = {
        ...((user.upiDetails && typeof user.upiDetails === 'object') ? user.upiDetails : {}),
        ...upiDetails
      };
      if (upiDetails.upiId !== undefined) {
        user.upiId = upiDetails.upiId;
      }
    }

    if (bankDetails !== undefined && typeof bankDetails === 'object') {
      user.bankDetails = {
        ...((user.bankDetails && typeof user.bankDetails === 'object') ? user.bankDetails : {}),
        ...bankDetails
      };
    }


    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email is already taken.' });
      }
      user.email = email.toLowerCase();
      user.emailVerified = false;
      
      // Generate new token
      const verificationToken = require('crypto').randomBytes(32).toString('hex');
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = Date.now() + 30 * 60 * 1000; // 30 mins
      
      // Send Verification Email
      await emailService.sendVerificationEmail(user, verificationToken);
    }

    await user.save();
    res.status(200).json({ success: true, user, message: 'Profile updated.' });
  } catch (err) {
    next(err);
  }
};


// ── POST /api/users ────────────────────────────────────────────────────────
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'tenant',
      ownerId: req.user.role === 'owner' ? req.user._id : null
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/users/:id ───────────────────────────────────────────────────
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Auth check
    if (req.user.role === 'owner' && String(user.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { name, email, isActive } = req.body;
    if (name) user.name = name;
    if (isActive !== undefined) user.isActive = isActive;

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ success: false, message: 'Email taken.' });
      
      user.email = email.toLowerCase();
      user.emailVerified = false;
      
      const verificationToken = require('crypto').randomBytes(32).toString('hex');
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = Date.now() + 30 * 60 * 1000;
      await emailService.sendVerificationEmail(user, verificationToken);
    }

    await user.save();
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
// ── DELETE /api/users/:id ──────────────────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Superadmins cannot be deleted.' });
    }

    // ── CASCADE DELETE / CLEANUP ───────────────────────────────────────────
    if (user.role === 'tenant') {
      // Find all tenancies for this user
      const tenancies = await Tenant.find({ userId: user._id });
      
      for (const t of tenancies) {
        if (t.status === 'active') {
          // Vacate room
          const room = await Room.findById(t.roomId);
          if (room) {
            const coOccupantCount = await CoOccupant.countDocuments({ tenantId: t._id });
            const totalOccupantsToRemove = 1 + coOccupantCount;
            room.currentOccupancy = Math.max(0, room.currentOccupancy - totalOccupantsToRemove);
            room.isFull = room.currentOccupancy >= room.capacity;
            await room.save();
          }
        }
        // Cleanup co-occupants for each tenancy
        await CoOccupant.deleteMany({ tenantId: t._id });
        // Cleanup complaints for each tenancy
        await Complaint.deleteMany({ tenantId: t._id });
      }

      // Delete all tenancy records
      await Tenant.deleteMany({ userId: user._id });
      // Delete all payment records
      await Payment.deleteMany({ userId: user._id });

    } else if (user.role === 'owner') {
      // Deep cleanup for owner: Properties, Rooms, Tenancies, Payments, Complaints
      await Property.deleteMany({ ownerId: user._id });
      await Room.deleteMany({ ownerId: user._id });
      await Tenant.deleteMany({ ownerId: user._id });
      await Payment.deleteMany({ ownerId: user._id });
      await Complaint.deleteMany({ ownerId: user._id });
      
      // Also delete the User accounts of tenants managed by this owner
      await User.deleteMany({ ownerId: user._id });
      
      // Cleanup activity logs
      await ActivityLog.deleteMany({ ownerId: user._id });
    }

    await user.deleteOne();
    res.status(200).json({ success: true, message: `User ${user.name} and all associated data deleted successfully.` });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/users/owner/upload-qr ────────────────────────────────────────
const uploadQRCode = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image.' });
    }

    const user = await User.findById(req.user._id);
    user.qrCodeImage = {
      secureUrl: req.file.path,
      publicId:  req.file.filename
    };

    await user.save();
    res.status(200).json({ success: true, user, message: 'QR Code uploaded.' });
  } catch (err) {
    next(err);
  }
};


// ── PATCH /api/users/profile/owner ─────────────────────────────────────────
const updateOwnerProfile = async (req, res, next) => {
  try {
    const { upiId, upiNumber, bankDetails } = req.body;
    
    const user = await User.findById(req.user._id);
    if (upiId !== undefined) user.upiId = upiId;
    if (upiNumber !== undefined) user.upiNumber = upiNumber;
    if (bankDetails !== undefined) user.bankDetails = bankDetails;

    await user.save();
    res.status(200).json({ success: true, user, message: 'Profile updated.' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users/admin/activity-logs (Super Admin only) ───────────────────
const getActivityLogs = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find()
      .populate('ownerId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.status(200).json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/users/profile/password (Self) ──────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid current password.' });
    }

    user.password = newPassword;
    await user.save();

    // Send security notification
    emailService.sendPasswordChangeNotification(user).catch(err => logger.error(`Failed to send password change email: ${err.message}`));

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/users/:id/reset-password (Admin) ──────────────────────────
const resetUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Authorization: SuperAdmin can reset anyone. Owner can reset their tenants.
    if (req.user.role === 'owner' && String(user.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    user.password = newPassword;
    await user.save();

    // Send security notification
    emailService.sendPasswordChangeNotification(user).catch(err => logger.error(`Failed to send password reset email: ${err.message}`));

    res.status(200).json({ success: true, message: `Password for ${user.name} has been reset.` });
  } catch (err) {
    next(err);
  }
};


// ── PATCH /api/users/profile/push-token (Mobile App — Expo push notifications) ────────────────
const savePushToken = async (req, res, next) => {
  try {
    const { token, platform, deviceName } = req.body;

    if (!token || typeof token !== 'string' || token.length < 5) {
      return res.status(400).json({ success: false, message: 'Valid token is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Remove existing entry for this token, then upsert
    user.expoPushTokens = (user.expoPushTokens || []).filter((t) => t.token !== token);
    user.expoPushTokens.push({
      token,
      platform: platform || 'android',
      deviceName: deviceName || null,
      lastSeenAt: new Date(),
    });

    // Cap at 10 tokens per user (oldest removed first)
    if (user.expoPushTokens.length > 10) {
      user.expoPushTokens = user.expoPushTokens.slice(-10);
    }

    await user.save();
    logger.info(`[PushToken] Saved push token for user ${user._id} (${platform})`);
    res.status(200).json({ success: true, message: 'Push token saved.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUser,
  getAdminStats,
  getOwnerPropertyMapping,
  getProfile,
  updateProfile,
  createUser,
  updateUser,
  deleteUser,
  updateOwnerProfile,
  uploadQRCode,
  getActivityLogs,
  changePassword,
  resetUserPassword,
  createUserValidation,
  savePushToken,
};
