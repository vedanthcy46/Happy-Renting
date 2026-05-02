'use strict';

const { body, param } = require('express-validator');
const Tenant        = require('../models/Tenant');
const User          = require('../models/User');
const logger        = require('../config/logger');
const tenantService = require('../services/tenantService');

// ── Validation chains ──────────────────────────────────────────────────────
const addTenantValidation = [
  body('userId')
    .isMongoId().withMessage('Valid user ID required'),
  body('roomId')
    .isMongoId().withMessage('Valid room ID required'),
  body('propertyId')
    .isMongoId().withMessage('Valid property ID required'),
  body('joinDate')
    .isISO8601().withMessage('Valid join date required (YYYY-MM-DD)')
    .toDate(),
  body('phone')
    .notEmpty().withMessage('Primary tenant phone number is required'),
  body('idProof')
    .optional().trim().escape(),
  body('advancePaid')
    .optional()
    .isFloat({ min: 0 }).withMessage('Advance paid must be non-negative'),
  body('securityDeposit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Security deposit must be non-negative'),
  body('notes')
    .optional().trim().isLength({ max: 500 }).escape(),
  body('coOccupants')
    .optional().isArray().withMessage('coOccupants must be an array'),
  body('coOccupants.*.name')
    .notEmpty().withMessage('Co-occupant name is required'),
];

const moveOutValidation = [
  param('id')
    .isMongoId().withMessage('Valid tenant ID required'),
  body('exitDate')
    .isISO8601().withMessage('Valid exit date required (YYYY-MM-DD)')
    .toDate(),
  body('notes')
    .optional().trim().isLength({ max: 500 }).escape(),
];

// ── GET /api/tenants ───────────────────────────────────────────────────────
const getTenants = async (req, res, next) => {
  try {
    const filter = {};

    // ownerId isolation
    if (req.user.role === 'owner') {
      filter.ownerId = req.user._id;
    } else if (req.user.role === 'superadmin' && req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }

    // Optional query filters (whitelist approach — never trust raw query)
    const { status, propertyId, roomId } = req.query;
    if (status && ['active', 'vacated'].includes(status)) {
      filter.status = status;
    }
    if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) {
      filter.propertyId = propertyId;
    }
    if (roomId && /^[a-f\d]{24}$/i.test(roomId)) {
      filter.roomId = roomId;
    }

    const tenants = await Tenant.find(filter)
      .populate('userId',     'name email')
      .populate('roomId',     'roomNumber floor monthlyRent currentOccupancy capacity')
      .populate('propertyId', 'name address')
      .populate('coOccupants')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: tenants.length, tenants });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/tenants/my  (Tenant self-view) ────────────────────────────────
const getMyTenancy = async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('userId',     'name email')
      .populate('roomId',     'roomNumber floor monthlyRent currentOccupancy capacity')
      .populate('propertyId', 'name address')
      .populate('ownerId',    'name qrCodeImage phone upiId upiNumber bankDetails')
      .populate('coOccupants');

    res.status(200).json({ success: true, tenant: tenant || null });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/tenants/:id ───────────────────────────────────────────────────
const getTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate('userId',     'name email role')
      .populate('roomId',     'roomNumber floor monthlyRent currentOccupancy capacity')
      .populate('propertyId', 'name address')
      .populate('coOccupants');

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant record not found.' });
    }

    // ownerId isolation by role
    if (req.user.role === 'tenant' && String(tenant.userId._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'owner' && String(tenant.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({ success: true, tenant });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/tenants  (Move-In) ───────────────────────────────────────────
const addTenant = async (req, res, next) => {
  try {
    const { 
      userId, roomId, propertyId, joinDate, advancePaid, securityDeposit, 
      notes, phone, idProof, coOccupants 
    } = req.body;

    // Resolve ownerId — always from authenticated session, never from body
    const ownerId = req.user.role === 'owner'
      ? req.user._id
      : req.body.ownerId;   // superadmin can specify ownerId

    const tenant = await tenantService.moveIn(
      { 
        userId, roomId, propertyId, ownerId, joinDate, 
        advancePaid, securityDeposit, notes, phone, idProof, coOccupants,
        tempPassword: req.body.tempPassword || req.body.password 
      },
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: 'Tenant moved in successfully.',
      tenant,
    });
  } catch (err) {
    // Service throws errors with .statusCode for HTTP mapping
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ── PATCH /api/tenants/:id ────────────────────────────────────────────────
const updateTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    // ownerId isolation
    if (req.user.role === 'owner' && String(tenant.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { 
      advancePaid, securityDeposit, joinDate, notes, status, rentDueDay,
      name, email, phone, idProof 
    } = req.body;

    // 1) Update Tenant-specific fields
    if (advancePaid    !== undefined) tenant.advancePaid = advancePaid;
    if (securityDeposit !== undefined) tenant.securityDeposit = securityDeposit;
    if (joinDate       !== undefined) tenant.joinDate    = joinDate;
    if (notes          !== undefined) tenant.notes       = notes;
    if (status         !== undefined) tenant.status      = status;
    if (rentDueDay     !== undefined) tenant.rentDueDay  = rentDueDay;
    if (phone          !== undefined) tenant.phone        = phone;
    if (idProof        !== undefined) tenant.idProof      = idProof;

    // ── Financial Validation ──
    if (Number(tenant.advancePaid) > Number(tenant.securityDeposit)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Initial advance or advance paid should be less than or equal to the security deposit.' 
      });
    }

    // 2) Update linked User fields if provided
    if (name || email || phone) {
      const user = await User.findById(tenant.userId);
      if (user) {
        if (name)  user.name  = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        await user.save({ validateBeforeSave: false });
      }
    }

    await tenant.save();

    // ── Sync Current Month Payment Due Date & Status ──
    if (rentDueDay !== undefined) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentMonthStr = today.toISOString().slice(0, 7);
        const newDueDate = new Date(today.getFullYear(), today.getMonth(), rentDueDay);
        newDueDate.setHours(0, 0, 0, 0);

        // Determine if the status needs to flip
        const isOverdueNow = newDueDate < today;
        
        // Find the payment for current month
        const Payment = require('../models/Payment');
        const currentPayment = await Payment.findOne({
          tenantId: tenant._id,
          month: currentMonthStr,
          status: { $nin: ['paid', 'verification_pending', 'processing'] }
        });

        if (currentPayment) {
          currentPayment.dueDate = newDueDate;
          // Only update status if it's currently pending/overdue/failed/partial
          if (['pending', 'overdue', 'failed', 'partial'].includes(currentPayment.status)) {
            currentPayment.status = isOverdueNow ? 'overdue' : 'pending';
          }
          await currentPayment.save();
          logger.info(`Synced dueDate & status for tenant ${tenant._id} to day ${rentDueDay} (Status: ${currentPayment.status})`);
        }
      } catch (syncErr) {
        logger.error(`Failed to sync payment dueDate: ${syncErr.message}`);
      }
    }

    res.status(200).json({ success: true, message: 'Tenant updated.', tenant });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/tenants/:id/moveout ────────────────────────────────────────
const moveOutTenant = async (req, res, next) => {
  try {
    const { exitDate, notes } = req.body;

    const tenant = await tenantService.moveOut(
      req.params.id,
      { exitDate, notes },
      req.user.role,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: 'Tenant moved out successfully.',
      tenant,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ── POST /api/tenants/:id/co-occupants ───────────────────────────────────
const addCoOccupants = async (req, res, next) => {
  try {
    const { coOccupants } = req.body;
    if (!coOccupants || !Array.isArray(coOccupants)) {
      return res.status(400).json({ success: false, message: 'Invalid co-occupants data.' });
    }

    const result = await tenantService.addCoOccupants(
      req.params.id,
      coOccupants,
      req.user._id,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: 'Co-occupants added successfully.',
      coOccupants: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getTenants,
  getTenant,
  addTenant,
  updateTenant,
  moveOutTenant,
  addCoOccupants,
  getMyTenancy,
  addTenantValidation,
  moveOutValidation,
};
