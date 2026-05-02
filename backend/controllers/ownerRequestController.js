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

    // 1. Check if a User account already exists for this email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Account already exists' });
    }

    // 2. Check for duplicate pending/approved request by Email or Phone
    const existing = await OwnerRequest.findOne({ $or: [{ email }, { phone }] });
    
    if (existing) {
      // Case 2: Request already under review
      if (existing.status === 'pending') {
        return res.status(409).json({ 
          success: false, 
          message: 'Request already under review' 
        });
      }
      
      // Case 3: Request already approved (but User check should have caught it)
      if (existing.status === 'approved') {
        return res.status(409).json({ 
          success: false, 
          message: 'Account already exists' 
        });
      }

      // Case 4: Previously rejected -> Update existing
      if (existing.status === 'rejected') {
        existing.name = name;
        existing.email = email; // In case phone matched but email changed
        existing.phone = phone;
        existing.propertyName = propertyName;
        existing.propertyLocation = propertyLocation;
        existing.status = 'pending';
        existing.rejectionReason = undefined;
        existing.createdAt = new Date(); // Reset time for priority
        await existing.save();
        
        logger.info(`Owner request resubmitted (updated): Email=${email} Phone=${phone}`);
        
        // Notify Admin (Non-blocking)
        emailService.sendAdminNewRequestAlert(existing).catch(e => logger.error(`Admin Alert Error: ${e.message}`));
        // Notify User (Non-blocking)
        emailService.sendRequestUnderReview(existing).catch(e => logger.error(`User Alert Error: ${e.message}`));

        return res.status(200).json({ 
          success: true, 
          message: 'sent successfully' 
        });
      }
    }

    // Case 1: New User / Request
    const request = await OwnerRequest.create({
      name, email, phone, propertyName, propertyLocation
    });

    logger.info(`New owner request created: ID=${request._id} Email=${request.email} Phone=${request.phone}`);

    // Notify Admin & User (Non-blocking)
    emailService.sendAdminNewRequestAlert(request).catch(e => logger.error(`Admin Alert Error: ${e.message}`));
    emailService.sendRequestUnderReview(request).catch(e => logger.error(`User Alert Error: ${e.message}`));

    res.status(201).json({ 
      success: true, 
      message: 'sent successfully' 
    });
  } catch (err) {
    // Handle MongoDB unique constraint errors manually if they slip through
    if (err.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        message: 'A request with this email or phone already exists.' 
      });
    }
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
    const { status, reason, password: providedPassword } = req.body;
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
      // 1. Use provided password or generate one
      const tempPassword = providedPassword || (crypto.randomBytes(4).toString('hex') + 'A1!');

      // 2. Generate Verification Token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = Date.now() + 30 * 60 * 1000; // 30 mins

      // 3. Create User account
      const user = await User.create({
        name: request.name,
        email: request.email,
        password: tempPassword,
        role: 'owner',
        isActive: true,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: tokenExpires
      });

      request.status = 'approved';
      await request.save();

      // 4. Send Approval & Verification Emails
      try {
        await emailService.sendRequestApproved(request, tempPassword);
        await emailService.sendVerificationEmail(user, verificationToken);
      } catch (e) {
        logger.error(`Email error (Approved/Verify): ${e.message}`);
      }
      
      logger.info(`Owner request approved: ${request.email}. User account created.`);

    } else {
      request.status = 'rejected';
      request.rejectionReason = reason;
      await request.save();

      // Send Rejection Email (Non-blocking)
      emailService.sendRequestRejected(request, reason).catch(e => logger.error(`Email error (Rejected): ${e.message}`));
      
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
