'use strict';

const { body, param } = require('express-validator');
const mongoose        = require('mongoose');
const Payment         = require('../models/Payment');
const paymentService  = require('../services/paymentService');
const billingService = require('../services/billingService');
const logger          = require('../config/logger');

// ── Validation chains ──────────────────────────────────────────────────────
const paymentValidation = [
  body('tenantId')
    .isMongoId().withMessage('Valid tenant ID required'),
  body('month')
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('Month must be in YYYY-MM format'),
  body('amount')
    .isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
  body('method')
    .optional()
    .isIn(['cash', 'bank_transfer', 'cheque', 'online', 'other'])
    .withMessage('Invalid payment method'),
  body('status')
    .optional()
    .isIn(['paid', 'pending', 'partial'])
    .withMessage('Invalid payment status'),
  body('paidDate')
    .optional().isISO8601().withMessage('Invalid paid date'),
  body('dueDate')
    .optional().isISO8601().withMessage('Invalid due date'),
  body('notes')
    .optional().trim().isLength({ max: 300 }).escape(),
];

// ── GET /api/payments ──────────────────────────────────────────────────────
const getPayments = async (req, res, next) => {
  try {
    const filter = {};
    
    // 1. ownerId isolation
    if (req.user.role === 'owner') {
      filter.ownerId = req.user._id;
      
      // TRIGGER AUTOMATED BILLING (Lazy Cron)
      // Every time an owner views their payments, we ensure bills are up to date.
      await billingService.generateMonthlyBills(req.user._id).catch(e => logger.error(`Auto-billing failed: ${e.message}`));
      await billingService.updateOverduePayments(req.user._id).catch(e => logger.error(`Overdue check failed: ${e.message}`));
    }
    
    // Tenants only see their own
    if (req.user.role === 'tenant') {
      filter.userId = req.user._id;

      // TRIGGER AUTOMATED BILLING (for tenant's specific owner)
      // We find the tenant record to get the ownerId
      const Tenant = require('../models/Tenant');
      const tenancy = await Tenant.findOne({ userId: req.user._id, status: 'active' });
      if (tenancy) {
        await billingService.generateMonthlyBills(tenancy.ownerId).catch(e => logger.error(`Auto-billing for tenant failed: ${e.message}`));
        await billingService.updateOverduePayments(tenancy.ownerId).catch(e => logger.error(`Overdue check for tenant failed: ${e.message}`));
      }
    }

    // Optional query filters
    const { tenantId, propertyId, month, status } = req.query;
    if (tenantId && /^[a-f\d]{24}$/i.test(tenantId))     filter.tenantId   = tenantId;
    if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) filter.propertyId = propertyId;
    if (month && /^\d{4}-\d{2}$/.test(month))            filter.month      = month;
    if (status)                                          filter.status     = status;

    const payments = await Payment.find(filter)
      .populate('tenantId', 'status joinDate')
      .populate('userId',   'name email')
      .populate('roomId',   'roomNumber floor')
      .populate('propertyId', 'name address')
      .populate('ownerId', 'name email upiId upiNumber bankDetails qrCodeImage')
      .populate('recordedBy', 'name')
      .sort({ month: -1, paidDate: -1 })
      .lean();

    res.status(200).json({ success: true, count: payments.length, payments });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/payments ─────────────────────────────────────────────────────
const createPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.recordPayment(req.body, {
      id: req.user._id,
      role: req.user.role
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      payment
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ── PATCH /api/payments/:id ────────────────────────────────────────────────
const updatePayment = async (req, res, next) => {
  try {
    const payment = await paymentService.updatePaymentStatus(
      req.params.id,
      req.body,
      { id: req.user._id, role: req.user.role }
    );

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully.',
      payment
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ── GET /api/payments/summary ──────────────────────────────────────────────
const getPaymentSummary = async (req, res, next) => {
  try {
    const matchFilter = {};
    if (req.user.role === 'owner') {
      matchFilter.ownerId = req.user._id;

      // TRIGGER AUTOMATED BILLING (Lazy Cron)
      await billingService.generateMonthlyBills(req.user._id).catch(e => logger.error(`Auto-billing failed: ${e.message}`));
      await billingService.updateOverduePayments(req.user._id).catch(e => logger.error(`Overdue check failed: ${e.message}`));
    }
    
    const { propertyId } = req.query;
    if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) {
      matchFilter.propertyId = new mongoose.Types.ObjectId(propertyId);
    }

    const summary = await Payment.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id         : '$status',
          totalAmount : { $sum: '$amount' },
          count       : { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({ success: true, summary });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/payments/:id/pay (Tenant only) ──────────────────────────────
const processPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Find payment and verify ownership
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    // Tenant can only pay their own payments
    if (String(payment.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only pay your own rent.' });
    }

    // 2. Prevent paying if already paid or processing
    if (payment.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This payment has already been completed.' });
    }
    if (payment.status === 'processing') {
      return res.status(400).json({ success: false, message: 'Payment is currently being processed. Please wait.' });
    }

    // 3. Atomically set to processing (idempotency safeguard)
    const updated = await Payment.findOneAndUpdate(
      { _id: id, status: { $nin: ['paid', 'processing'] } },
      { $set: { status: 'processing' } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ success: false, message: 'Payment state changed. Please refresh and try again.' });
    }

    logger.info(`Payment processing started: ${id} by user ${req.user._id}`);

    // 4. Simulate delay (2-3 seconds)
    setTimeout(async () => {
      try {
        const isSuccess = Math.random() < 0.8; // 80% success rate
        const status    = isSuccess ? 'paid' : 'failed';
        const txId      = `TXN_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        await Payment.findByIdAndUpdate(id, {
          $set: {
            status,
            transactionId : isSuccess ? txId : undefined,
            paidDate      : isSuccess ? new Date() : undefined,
            method        : 'online'
          }
        });

        logger.info(`Payment ${id} result: ${status} (TX: ${txId})`);

        // Notify Tenant of result
        try {
          const populated = await Payment.findById(id).populate('userId propertyId roomId ownerId');
          if (populated && populated.userId && populated.userId.email) {
            await emailService.sendPaymentStatusNotification(
              populated.userId,
              populated,
              populated.propertyId,
              populated.roomId,
              populated.ownerId
            );
          }
        } catch (emailErr) {
          logger.error(`Failed to send simulated payment notification: ${emailErr.message}`);
        }
      } catch (err) {
        logger.error(`Error finalizing simulated payment ${id}: ${err.message}`);
      }
    }, 2500);

    res.status(202).json({
      success: true,
      message: 'Payment is being processed. Status will update shortly.',
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/payments/:id/upload-proof (Tenant only) ──────────────────────
const uploadPaymentProof = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file.' });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    // Authorization
    if (String(payment.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Logic: if there's an old image, Cloudinary storage usually handles replacement if we didn't specify publicId,
    // but we want to be explicit.
    // However, multer-storage-cloudinary creates a new one every time unless we provide the same publicId.
    // We'll just update the record with the new URL and ID.
    
    payment.proofImage = {
      secureUrl: req.file.path || req.file.secure_url,
      publicId : req.file.filename || req.file.public_id
    };
    
    // Change status to verification pending so owner can review it
    payment.status = 'verification_pending';
    
    await payment.save();

    // Send Notification to Owner
    try {
      const populated = await Payment.findById(id).populate('ownerId userId propertyId roomId');
      if (populated && populated.ownerId && populated.ownerId.email) {
        await emailService.sendPaymentProofNotification(
          populated.ownerId, 
          populated.userId, 
          populated, 
          populated.propertyId, 
          populated.roomId
        );
      }
    } catch (emailErr) {
      logger.error(`Failed to send proof upload email: ${emailErr.message}`);
    }

    logger.info(`[PROOF UPLOAD] payment=${id} user=${req.user._id} url=${req.file.path}`);
    res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully.',
      proofImage: payment.proofImage
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPayments,
  createPayment,
  updatePayment,
  getPaymentSummary,
  processPayment,
  uploadPaymentProof,
  paymentValidation
};
