'use strict';

/**
 * paymentControllerV2.js
 * ─────────────────────────────────────────────────────────────────────────────
 * API handlers for ledger-based payment system
 */

const { body, param } = require('express-validator');
const mongoose = require('mongoose');
const paymentServiceV2 = require('../services/paymentServiceV2');
const billingServiceV2 = require('../services/billingServiceV2');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const Tenant = require('../models/Tenant');
const logger = require('../config/logger');
const { Transform } = require('stream');

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION CHAINS
// ─────────────────────────────────────────────────────────────────────────

const rentRecordValidation = [
  body('tenantId').isMongoId().withMessage('Valid tenant ID required'),
  body('month').matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('Month must be in YYYY-MM format'),
  body('totalRent').isFloat({ min: 0 }).withMessage('Total rent must be non-negative'),
];

const transactionValidation = [
  body('rentRecordId').isMongoId().withMessage('Valid rent record ID required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod')
    .isIn(['cash', 'upi', 'bank_transfer', 'cheque', 'other'])
    .withMessage('Invalid payment method'),
  body('paymentDate').optional().isISO8601().withMessage('Invalid payment date'),
  body('note').optional().trim().isLength({ max: 300 }).escape(),
  body('transactionId').optional().trim(),
];

// ─────────────────────────────────────────────────────────────────────────
// GET: List all rent records
// ─────────────────────────────────────────────────────────────────────────

const getRentRecords = async (req, res, next) => {
  try {
    const filters = {};

    // Role-based filtering
    if (req.user.role === 'owner') {
      filters.ownerId = req.user._id;

      // Lazy billing trigger
      await billingServiceV2.generateMonthlyBills(req.user._id)
        .catch(e => logger.error(`Auto-billing failed: ${e.message}`));
      await billingServiceV2.updateOverduePayments(req.user._id)
        .catch(e => logger.error(`Overdue check failed: ${e.message}`));
    } else if (req.user.role === 'tenant') {
      // Tenant sees only their rent records
      const tenancy = await Tenant.findOne({ userId: req.user._id, status: 'active' });
      if (tenancy) {
        filters.tenantId = tenancy._id;

        // Lazy billing for tenant's owner
        await billingServiceV2.generateMonthlyBills(tenancy.ownerId)
          .catch(e => logger.error(`Auto-billing for tenant failed: ${e.message}`));
      }
    }

    // Query filters
    const { tenantId, propertyId, month, status } = req.query;
    if (tenantId && /^[a-f\d]{24}$/i.test(tenantId)) filters.tenantId = tenantId;
    if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) filters.propertyId = propertyId;
    if (month && /^\d{4}-\d{2}$/.test(month)) filters.month = month;
    if (status) filters.status = status;

    const rentRecords = await MonthlyRentRecord.find(filters)
      .populate('tenantId', 'status joinDate')
      .populate('userId', 'name email phone')
      .populate('roomId', 'roomNumber floor monthlyRent')
      .populate('propertyId', 'name address')
      .populate('ownerId', 'name email')
      .sort({ month: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: rentRecords.length,
      rentRecords
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET: Single rent record with transactions
// ─────────────────────────────────────────────────────────────────────────

const getRentRecordDetail = async (req, res, next) => {
  try {
    const { rentRecordId } = req.params;

    const { rentRecord, transactions } = await paymentServiceV2.getMonthlyRentRecordWithTransactions(rentRecordId);

    // Security check
    if (req.user.role === 'owner' && String(rentRecord.ownerId._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.user.role === 'tenant' && String(rentRecord.userId._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      rentRecord,
      transactions,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// POST: Create/ensure monthly rent record
// ─────────────────────────────────────────────────────────────────────────

const createRentRecord = async (req, res, next) => {
  try {
    const { tenantId, month, totalRent } = req.body;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Security
    if (req.user.role === 'owner' && String(tenant.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const rentRecord = await paymentServiceV2.ensureMonthlyRentRecord(
      tenantId,
      month,
      totalRent,
      { notes: req.body.notes }
    );

    res.status(201).json({
      success: true,
      message: 'Rent record created successfully',
      rentRecord
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PATCH: Update rent record
// ─────────────────────────────────────────────────────────────────────────

const updateRentRecord = async (req, res, next) => {
  try {
    const { rentRecordId } = req.params;

    const rentRecord = await paymentServiceV2.updateMonthlyRentRecord(
      rentRecordId,
      req.body,
      { id: req.user._id, role: req.user.role }
    );

    res.status(200).json({
      success: true,
      message: 'Rent record updated successfully',
      rentRecord
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// POST: Add payment transaction
// ─────────────────────────────────────────────────────────────────────────

const addPaymentTransaction = async (req, res, next) => {
  try {
    const { rentRecordId, tenantId, amount, paymentMethod, paymentDate, note, transactionId, idempotencyKey } = req.body;

    // Ensure rent record exists
    let rentRecord = await MonthlyRentRecord.findById(rentRecordId);
    if (!rentRecord) {
      return res.status(404).json({ success: false, message: 'Rent record not found' });
    }

    // Security
    if (req.user.role === 'owner' && String(rentRecord.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let proofImage = null;
    if (req.file) {
      proofImage = {
        secureUrl: req.file.path,
        publicId: req.file.filename,
      };
    }

    // Add transaction
    const transaction = await paymentServiceV2.addPaymentTransaction(
      {
        rentRecordId,
        tenantId,
        amount,
        paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        note,
        transactionId,
        proofImage,
        idempotencyKey,
      },
      { id: req.user._id, role: req.user.role }
    );

    // Fetch updated rent record
    rentRecord = await MonthlyRentRecord.findById(rentRecordId);

    res.status(201).json({
      success: true,
      message: 'Payment transaction recorded successfully',
      transaction,
      rentRecord
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// DELETE: Reverse payment transaction
// ─────────────────────────────────────────────────────────────────────────

const reversePaymentTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await paymentServiceV2.reverseTransaction(
      transactionId,
      reason,
      { id: req.user._id, role: req.user.role }
    );

    // Fetch updated rent record
    const rentRecord = await MonthlyRentRecord.findById(transaction.rentRecordId);

    res.status(200).json({
      success: true,
      message: 'Payment transaction reversed successfully',
      transaction,
      rentRecord
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET: Payment summary (dashboard metrics)
// ─────────────────────────────────────────────────────────────────────────

const getPaymentSummary = async (req, res, next) => {
  try {
    const filters = {};

    if (req.user.role === 'owner') {
      filters.ownerId = req.user._id;

      // Lazy billing
      await billingServiceV2.generateMonthlyBills(req.user._id)
        .catch(e => logger.error(`Auto-billing failed: ${e.message}`));
      await billingServiceV2.updateOverduePayments(req.user._id)
        .catch(e => logger.error(`Overdue check failed: ${e.message}`));
    }

    if (req.query.propertyId && /^[a-f\d]{24}$/i.test(req.query.propertyId)) {
      filters.propertyId = new mongoose.Types.ObjectId(req.query.propertyId);
    }

    const metrics = await billingServiceV2.getSummaryMetrics(
      req.user._id,
      filters
    );

    res.status(200).json({
      success: true,
      metrics
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET: Transaction history
// ─────────────────────────────────────────────────────────────────────────

const getTransactionHistory = async (req, res, next) => {
  try {
    const filters = {};

    if (req.user.role === 'owner') {
      filters.ownerId = req.user._id;
    } else if (req.user.role === 'tenant') {
      filters.tenantId = (await Tenant.findOne({ userId: req.user._id })?._id) || null;
    }

    const { tenantId, rentRecordId, month } = req.query;
    if (tenantId && /^[a-f\d]{24}$/i.test(tenantId)) filters.tenantId = tenantId;
    if (rentRecordId && /^[a-f\d]{24}$/i.test(rentRecordId)) filters.rentRecordId = rentRecordId;

    const transactions = await PaymentTransaction.find(filters)
      .populate('recordedBy', 'name')
      .populate('rentRecordId', 'month totalRent totalPaid status')
      .sort({ paymentDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET: Export Transactions as CSV (Memory-Safe Stream)
// ─────────────────────────────────────────────────────────────────────────
const exportTransactionsCSV = async (req, res, next) => {
  try {
    const { month, year } = req.query; // optional filtering
    const filters = {};

    // Enforce role isolation
    if (req.user.role === 'owner') {
      filters.ownerId = req.user._id;
    } else if (req.user.role === 'tenant') {
      filters.tenantId = req.user._id;
    }

    if (month && year) {
      // Create date range for the specified month
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filters.paymentDate = { $gte: start, $lte: end };
    }

    // Set HTTP headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_export_${Date.now()}.csv"`);

    // Create a custom Transform stream to convert JSON to CSV
    const csvTransform = new Transform({
      objectMode: true,
      transform(doc, encoding, callback) {
        if (!this.headerWritten) {
          this.push('Transaction ID,Date,Amount,Method,Status,Note\n');
          this.headerWritten = true;
        }

        // Properly escape strings for CSV (wrap in quotes if contains comma)
        const escapeCSV = (str) => {
          if (!str) return '';
          const s = String(str).replace(/"/g, '""');
          return `"${s}"`;
        };

        const dateStr = doc.paymentDate ? new Date(doc.paymentDate).toISOString().split('T')[0] : '';
        const row = [
          escapeCSV(doc._id.toString()),
          escapeCSV(dateStr),
          doc.amount,
          escapeCSV(doc.paymentMethod),
          escapeCSV(doc.status),
          escapeCSV(doc.note)
        ].join(',');

        this.push(row + '\n');
        callback();
      }
    });

    // Mongoose cursor stream directly piped to response
    PaymentTransaction.find(filters)
      .sort({ paymentDate: -1 })
      .lean()
      .cursor()
      .pipe(csvTransform)
      .on('error', (err) => {
        logger.error(`[CSV STREAM ERROR] ${err.message}`);
        // Cannot send 500 cleanly if headers are already sent, but we can end the stream
        res.end();
      })
      .pipe(res);

  } catch (err) {
    next(err);
  }
};

module.exports = {
  // Validations
  rentRecordValidation,
  transactionValidation,
  // Handlers
  getRentRecords,
  getRentRecordDetail,
  createRentRecord,
  updateRentRecord,
  addPaymentTransaction,
  reversePaymentTransaction,
  getPaymentSummary,
  getTransactionHistory,
  exportTransactionsCSV,
};
