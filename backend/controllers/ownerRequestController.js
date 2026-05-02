'use strict';

const { body, validationResult } = require('express-validator');
const OwnerRequest = require('../models/OwnerRequest');
const User         = require('../models/User');
const emailService = require('../services/emailService');
const logger       = require('../config/logger');
const crypto       = require('crypto');

// ── Validation ─────────────────────────────────────────────────────────────
const validateRequest = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('propertyName').optional().trim(),
  body('propertyLocation').optional().trim(),
];

// ── 1. Submit Request (Public) ─────────────────────────────────────────────
const submitRequest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone, propertyName, propertyLocation } = req.body;

    // Check for duplicate pending/approved request
    const existing = await OwnerRequest.findOne({ email });
    if (existing && existing.status !== 'rejected') {
      return res.status(409).json({ 
        success: false, 
        message: 'A request with this email is already being processed.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'This email is already registered as a user.' });
    }

    const request = await OwnerRequest.create({
      name, email, phone, propertyName, propertyLocation
    });

    logger.info(`New owner request created: ID=${request._id} Email=${request.email}`);

    // Notify User
    try {
      await emailService.sendRequestUnderReview(request);
    } catch (e) {
      logger.error(`Email error (Under Review): ${e.message}`);
      // We don't fail the whole request if email fails, but we'll know from logs
    }

    res.status(201).json({ 
      success: true, 
      message: 'Your request has been submitted. Admin will contact you soon.' 
    });
  } catch (err) {
    next(err);
  }
};

// ── 2. Get All Requests (Admin Only) ──────────────────────────────────────
const getRequests = async (req, res, next) => {
  try {
    const requests = await OwnerRequest.find().sort({ createdAt: -1 });
    logger.info(`Fetched ${requests.length} owner requests for admin.`);
    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
};

// ── 3. Update Status (Admin Only) ─────────────────────────────────────────
const updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    logger.info(`Status update request: ID=${id} NewStatus=${status}`);

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const request = await OwnerRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request has already been processed.' });
    }

    if (status === 'approved') {
      // 1. Generate password
      const tempPassword = crypto.randomBytes(4).toString('hex') + 'A1!'; // e.g. "a1b2c3d4A1!"

      // 2. Create User account
      const user = await User.create({
        name: request.name,
        email: request.email,
        password: tempPassword,
        role: 'owner',
        isActive: true
      });

      request.status = 'approved';
      await request.save();

      // 3. Send Approval Email
      try {
        await emailService.sendRequestApproved(request, tempPassword);
      } catch (e) {
        logger.error(`Email error (Approved): ${e.message}`);
      }
      logger.info(`Owner request approved: ${request.email}. User account created.`);

    } else {
      request.status = 'rejected';
      request.rejectionReason = reason;
      await request.save();

      // Send Rejection Email
      try {
        await emailService.sendRequestRejected(request, reason);
      } catch (e) {
        logger.error(`Email error (Rejected): ${e.message}`);
      }
      logger.info(`Owner request rejected: ${request.email}`);
    }

    res.status(200).json({ success: true, message: `Request ${status} successfully.` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitRequest,
  getRequests,
  updateRequestStatus,
  validateRequest
};
