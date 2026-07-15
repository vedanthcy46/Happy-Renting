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

    // 0. Verify email OTP token
    const { verifiedToken } = req.body;
    if (!verifiedToken) {
      return res.status(400).json({ success: false, message: 'Email verification required. Please verify your email first.' });
    }
    const OTPModel = require('../models/OTP');
    const otpRecord = await OTPModel.findOne({
      email: email.toLowerCase(),
      type: 'verified',
      value: verifiedToken,
      expiresAt: { $gt: new Date() }
    });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Email verification expired or invalid. Please verify your email again.' });
    }
    // Clean up the verified token after use
    await OTPModel.deleteMany({ email: email.toLowerCase() });

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
      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ success: false, message: 'A rejection reason (min 5 characters) is required.' });
      }
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

// ── 4. Send OTP for Email Verification (Public — for owner request form) ──
const sendRequestOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }

    // Check if a User account already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Check if already approved
    const existingApproved = await OwnerRequest.findOne({ email: email.toLowerCase(), status: 'approved' });
    if (existingApproved) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const OTP = require('../models/OTP');
    // Delete any previous OTP for this email
    await OTP.deleteMany({ email: email.toLowerCase(), type: 'otp' });

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OTP.create({ email: email.toLowerCase(), type: 'otp', value: otpCode, expiresAt });

    // Send OTP email
    await emailService.sendRequestOTPEmail(email, otpCode);

    logger.info(`[OwnerRequest OTP] Sent OTP to ${email}`);
    res.status(200).json({ success: true, message: 'OTP sent to your email.' });
  } catch (err) {
    next(err);
  }
};

// ── 5. Verify OTP (Public — before allowing form submission) ──────────────
const verifyRequestOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const OTP = require('../models/OTP');
    const record = await OTP.findOne({
      email: email.toLowerCase(),
      type: 'otp',
      value: otp.toString(),
      expiresAt: { $gt: new Date() }
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    // Mark as verified — replace otp record with a verified token
    await OTP.deleteMany({ email: email.toLowerCase() });
    const verifiedToken = crypto.randomBytes(32).toString('hex');
    await OTP.create({
      email: email.toLowerCase(),
      type: 'verified',
      value: verifiedToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 min to complete form
    });

    logger.info(`[OwnerRequest OTP] Email verified: ${email}`);
    res.status(200).json({ success: true, message: 'Email verified successfully.', verifiedToken });
  } catch (err) {
    next(err);
  }
};

// ── 6. Toggle Priority Flag (Admin Only) ──────────────────────────────────
const togglePriority = async (req, res, next) => {
  try {
    const request = await OwnerRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    request.isPriority = !request.isPriority;
    await request.save();
    logger.info(`[OwnerRequest] Priority toggled: ID=${req.params.id} isPriority=${request.isPriority}`);
    res.status(200).json({ success: true, isPriority: request.isPriority });
  } catch (err) {
    next(err);
  }
};

// ── 7. Add Admin Note (Admin Only) ────────────────────────────────────────
const addAdminNote = async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note || note.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Note must be at least 3 characters.' });
    }
    const request = await OwnerRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    request.adminNotes.push({
      note    : note.trim(),
      addedAt : new Date(),
      addedBy : req.user.name,
    });
    await request.save();
    logger.info(`[OwnerRequest] Note added by ${req.user.name} to request ID=${req.params.id}`);
    res.status(201).json({ success: true, adminNotes: request.adminNotes });
  } catch (err) {
    next(err);
  }
};

// ── 8. Bulk Update Status (Admin Only) ────────────────────────────────────
const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { requestIds, status, reason } = req.body;
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No requests selected.' });
    }
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    if (status === 'rejected' && (!reason || reason.trim().length < 5)) {
      return res.status(400).json({ success: false, message: 'A rejection reason (min 5 characters) is required.' });
    }

    let successCount = 0;
    
    // We process sequentially to avoid overwhelming email sending
    for (const id of requestIds) {
      const request = await OwnerRequest.findById(id);
      if (!request || request.status !== 'pending') continue;

      if (status === 'approved') {
        const tempPassword = crypto.randomBytes(4).toString('hex') + 'A1!';
        const verifiedToken = crypto.randomBytes(32).toString('hex');
        
        await User.create({
          name: request.name,
          email: request.email,
          phone: request.phone,
          role: 'owner',
          password: tempPassword,
          mustChangePassword: true,
          emailVerified: true,
          emailVerificationToken: verifiedToken
        });
        
        request.status = 'approved';
        await request.save();
        await emailService.sendRequestApproved(request, tempPassword);
        successCount++;
      } else if (status === 'rejected') {
        request.status = 'rejected';
        request.rejectionReason = reason.trim();
        await request.save();
        await emailService.sendRequestRejected(request, request.rejectionReason);
        successCount++;
      }
    }

    logger.info(`[OwnerRequest Bulk] Processed ${successCount} requests to status: ${status}`);
    res.status(200).json({ success: true, message: `Successfully updated ${successCount} requests.` });
  } catch (err) {
    next(err);
  }
};

// ── 9. Auto-Expire Old Requests (Admin Only) ──────────────────────────────
const expireOldRequests = async (req, res, next) => {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const oldRequests = await OwnerRequest.find({
      status: 'pending',
      createdAt: { $lt: fourteenDaysAgo }
    });

    for (const request of oldRequests) {
      request.status = 'expired';
      await request.save();
      // Send expiration notification in background
      emailService.sendRequestExpired(request).catch(e => logger.error(`Request Expired Alert Error: ${e.message}`));
    }

    logger.info(`[OwnerRequest Expiry] Expired ${oldRequests.length} old pending requests.`);
    res.status(200).json({ success: true, count: oldRequests.length, message: `Expired ${oldRequests.length} old requests.` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitRequest,
  getRequests,
  updateRequestStatus,
  validateRequest,
  sendRequestOTP,
  verifyRequestOTP,
  togglePriority,
  addAdminNote,
  bulkUpdateStatus,
  expireOldRequests,
};
