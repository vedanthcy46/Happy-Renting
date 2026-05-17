'use strict';

/**
 * paymentServiceV2.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Ledger-based payment system with support for:
 *   - Multiple transactions per month
 *   - Editable rent records
 *   - Cash and online payments
 *   - Proper transaction history
 *   - Auto-calculated status
 *   - Audit logging
 */

const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const Tenant = require('../models/Tenant');
const emailService = require('./emailService');
const logger = require('../config/logger');
const logActivity = require('../utils/activityLogger');

// ─────────────────────────────────────────────────────────────────────────
// CORE: Create or get monthly rent record
// ─────────────────────────────────────────────────────────────────────────

/**
 * ensureMonthlyRentRecord(tenantId, month, totalRent, options?)
 * Creates or returns existing monthly rent record
 */
const ensureMonthlyRentRecord = async (tenantId, month, totalRent, options = {}) => {
  // Fetch tenant context
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const err = new Error('Tenant not found');
    err.statusCode = 404;
    throw err;
  }

  if (tenant.status === 'vacated' && !options.allowVacated) {
    const err = new Error('Cannot create rent record for vacated tenant');
    err.statusCode = 400;
    throw err;
  }

  // Try to find existing record
  let rentRecord = await MonthlyRentRecord.findOne({
    tenantId,
    month,
  });

  if (!rentRecord) {
    // Create new rent record
    const dueDay = tenant.rentDueDay || 5;
    const [year, monthNum] = month.split('-').map(Number);
    
    // Set to the next calendar month (e.g. March stay has due date in April)
    let dueYear = year;
    let dueMonthIndex = monthNum; // since monthNum is 1-12, this is the index of the next month (0-11)
    if (dueMonthIndex > 11) {
      dueMonthIndex = 0;
      dueYear += 1;
    }

    let tempDate = new Date(dueYear, dueMonthIndex, dueDay);
    if (tempDate.getMonth() !== dueMonthIndex) {
      tempDate = new Date(dueYear, dueMonthIndex + 1, 0); // Last day of target month
    }
    tempDate.setHours(12, 0, 0, 0); // Timezone-immune noon-based shift
    const dueDate = tempDate;

    try {
      rentRecord = await MonthlyRentRecord.create({
        tenantId,
        userId: tenant.userId,
        roomId: tenant.roomId,
        propertyId: tenant.propertyId,
        ownerId: tenant.ownerId,
        month,
        totalRent,
        rentAmountAtGeneration: totalRent, // Snapshot
        dueDate,
        notes: options.notes || 'System generated monthly rent record.',
      });

      logger.info(`[RENT RECORD] Created rentRecordId=${rentRecord._id} for tenant=${tenantId} month=${month}`);
    } catch (createErr) {
      // Idempotency check: If two parallel requests try to create the same month record, E11000 fires
      if (createErr.code === 11000) {
        logger.warn(`[RENT RECORD] Duplicate creation attempt for tenant=${tenantId} month=${month}, fetching existing`);
        rentRecord = await MonthlyRentRecord.findOne({ tenantId, month });
      } else {
        throw createErr;
      }
    }
  } else if (options.updateTotalRent && totalRent !== rentRecord.totalRent) {
    // Update total rent if provided (e.g., rent increase)
    rentRecord.totalRent = totalRent;
    await rentRecord.save();
    logger.info(`[RENT RECORD] Updated totalRent for rentRecordId=${rentRecord._id}`);
  }

  return rentRecord;
};

// ─────────────────────────────────────────────────────────────────────────
// CORE: Add payment transaction
// ─────────────────────────────────────────────────────────────────────────

/**
 * addPaymentTransaction(params, caller)
 * 
 * @param {{
 *   rentRecordId,
 *   tenantId,
 *   amount,
 *   paymentMethod,
 *   transactionId?,
 *   paymentDate?,
 *   note?,
 *   proofImage?
 * }} params
 * @param {{ id, role }} caller
 */
const addPaymentTransaction = async (params, caller) => {
  const {
    rentRecordId,
    tenantId,
    amount,
    paymentMethod,
    transactionId,
    paymentDate = new Date(),
    note,
    proofImage,
    idempotencyKey
  } = params;

  // Validation
  if (!amount || amount <= 0) {
    const err = new Error('Amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }

  if (!['cash', 'upi', 'bank_transfer', 'cheque', 'other'].includes(paymentMethod)) {
    const err = new Error('Invalid payment method');
    err.statusCode = 400;
    throw err;
  }

  // Fetch rent record and tenant
  const rentRecord = await MonthlyRentRecord.findById(rentRecordId);
  if (!rentRecord) {
    const err = new Error('Rent record not found');
    err.statusCode = 404;
    throw err;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const err = new Error('Tenant not found');
    err.statusCode = 404;
    throw err;
  }

  // Security: owner isolation
  if (caller.role === 'owner' && String(rentRecord.ownerId) !== String(caller.id)) {
    const err = new Error('Access denied. This payment does not belong to your properties');
    err.statusCode = 403;
    throw err;
  }

  // Prevent overpayment in single transaction (but allow total > rent for adjustments)
  const projectedTotal = rentRecord.totalPaid + amount;
  if (projectedTotal > rentRecord.totalRent && amount > rentRecord.totalRent) {
    const err = new Error(`Amount exceeds remaining balance of ₹${rentRecord.remainingAmount}`);
    err.statusCode = 400;
    throw err;
  }

  // Create transaction with idempotency protection
  let transaction;
  try {
    transaction = await PaymentTransaction.create({
      rentRecordId,
      tenantId,
      ownerId: rentRecord.ownerId,
      propertyId: rentRecord.propertyId,
      amount,
      paymentMethod,
      transactionId: transactionId || null,
      paymentDate,
      note,
      proofImage: proofImage || { secureUrl: null, publicId: null },
      recordedBy: caller.id,
      status: 'completed',
      idempotencyKey: idempotencyKey || undefined,
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.idempotencyKey) {
      const duplicateErr = new Error('Duplicate payment submission detected.');
      duplicateErr.statusCode = 409; // Conflict
      throw duplicateErr;
    }
    throw err;
  }

  logger.info(`[TRANSACTION] Created txnId=${transaction._id} rentId=${rentRecordId} amount=₹${amount}`);

  // Update rent record totals
  rentRecord.totalPaid += amount;
  await rentRecord.save(); // Pre-save hook will recalculate status & remaining

  if (caller.role === 'owner') {
    await logActivity(
      caller.id,
      'PAYMENT_TRANSACTION_ADDED',
      transaction._id,
      'PaymentTransaction',
      `Added ₹${amount} via ${paymentMethod} to month ${rentRecord.month}`
    );
  }

  // Send notification to tenant
  try {
    const populated = await rentRecord.populate('userId propertyId roomId ownerId');
    if (populated.userId && populated.userId.email) {
      await emailService.sendPaymentTransactionNotification(
        populated.userId,
        transaction,
        rentRecord,
        populated.propertyId,
        populated.roomId,
        populated.ownerId
      );
    }
  } catch (emailErr) {
    logger.error(`[EMAIL] Failed to send transaction notification: ${emailErr.message}`);
  }

  return transaction;
};

// ─────────────────────────────────────────────────────────────────────────
// RETRIEVE: Get rent record with transactions
// ─────────────────────────────────────────────────────────────────────────

/**
 * getMonthlyRentRecordWithTransactions(rentRecordId)
 */
const getMonthlyRentRecordWithTransactions = async (rentRecordId) => {
  const rentRecord = await MonthlyRentRecord.findById(rentRecordId)
    .populate('tenantId', 'status joinDate exitDate')
    .populate('userId', 'name email phone')
    .populate('roomId', 'roomNumber floor monthlyRent')
    .populate('propertyId', 'name address')
    .populate('ownerId', 'name email upiId bankDetails')
    .lean();

  if (!rentRecord) {
    const err = new Error('Rent record not found');
    err.statusCode = 404;
    throw err;
  }

  // Get all transactions for this rent record
  const transactions = await PaymentTransaction.find({ rentRecordId })
    .populate('recordedBy', 'name')
    .sort({ paymentDate: -1 })
    .lean();

  return {
    rentRecord,
    transactions,
  };
};

// ─────────────────────────────────────────────────────────────────────────
// RETRIEVE: List rent records by filter
// ─────────────────────────────────────────────────────────────────────────

/**
 * getRentRecordsByOwner(ownerId, filters?)
 */
const getRentRecordsByOwner = async (ownerId, filters = {}) => {
  const query = { ownerId };

  if (filters.tenantId) query.tenantId = filters.tenantId;
  if (filters.propertyId) query.propertyId = filters.propertyId;
  if (filters.month) query.month = filters.month;
  if (filters.status) query.status = filters.status;

  const rentRecords = await MonthlyRentRecord.find(query)
    .populate('tenantId', 'status')
    .populate('userId', 'name email')
    .populate('roomId', 'roomNumber monthlyRent')
    .populate('propertyId', 'name')
    .sort({ month: -1 })
    .lean();

  return rentRecords;
};

/**
 * getRentRecordsByTenant(tenantId)
 */
const getRentRecordsByTenant = async (tenantId) => {
  const rentRecords = await MonthlyRentRecord.find({ tenantId })
    .populate('roomId', 'roomNumber monthlyRent')
    .populate('propertyId', 'name address')
    .populate('ownerId', 'name')
    .sort({ month: -1 })
    .lean();

  return rentRecords;
};

// ─────────────────────────────────────────────────────────────────────────
// UPDATE: Edit rent record
// ─────────────────────────────────────────────────────────────────────────

/**
 * updateMonthlyRentRecord(rentRecordId, updateData, caller)
 * Allows editing notes, status overrides, reminder flags
 */
const updateMonthlyRentRecord = async (rentRecordId, updateData, caller) => {
  const rentRecord = await MonthlyRentRecord.findById(rentRecordId);
  if (!rentRecord) {
    const err = new Error('Rent record not found');
    err.statusCode = 404;
    throw err;
  }

  // Security: owner isolation
  if (caller.role === 'owner' && String(rentRecord.ownerId) !== String(caller.id)) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  // Allowed updates
  const { notes, reminderSent, advanceBalance, totalRent, status } = updateData;

  if (notes !== undefined) {
    rentRecord.notes = notes;
  }
  if (reminderSent !== undefined) {
    rentRecord.reminderSent = reminderSent;
    if (reminderSent) {
      rentRecord.reminderSentAt = new Date();
    }
  }
  if (advanceBalance !== undefined) {
    rentRecord.advanceBalance = Math.max(0, advanceBalance);
  }
  // Allow updating total rent if needed (e.g., rent increased mid-month)
  if (totalRent !== undefined && totalRent > 0) {
    rentRecord.totalRent = totalRent;
  }
  if (status !== undefined) {
    if (!['pending', 'partial', 'paid', 'overdue'].includes(status)) {
      const err = new Error('Invalid status value. Must be pending, partial, paid, or overdue.');
      err.statusCode = 400;
      throw err;
    }
    rentRecord.status = status;
  }

  await rentRecord.save();

  logger.info(`[RENT RECORD] Updated rentRecordId=${rentRecordId} by ${caller.id}`);

  if (caller.role === 'owner') {
    await logActivity(
      caller.id,
      'RENT_RECORD_UPDATED',
      rentRecord._id,
      'MonthlyRentRecord',
      `Updated rent record for month ${rentRecord.month}`
    );
  }

  return rentRecord;
};

// ─────────────────────────────────────────────────────────────────────────
// UPDATE: Reverse transaction (for refunds/corrections)
// ─────────────────────────────────────────────────────────────────────────

/**
 * reverseTransaction(transactionId, reason, caller)
 * Marks transaction as reversed (doesn't delete, maintains history)
 */
const reverseTransaction = async (transactionId, reason, caller) => {
  const transaction = await PaymentTransaction.findById(transactionId);
  if (!transaction) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }

  // Security: owner isolation
  if (caller.role === 'owner' && String(transaction.ownerId) !== String(caller.id)) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  if (transaction.status !== 'completed' && transaction.status !== 'reversed') {
    const err = new Error('Can only change status of completed or reversed transactions');
    err.statusCode = 400;
    throw err;
  }

  const isReversing = transaction.status === 'completed';
  const nextStatus = isReversing ? 'reversed' : 'completed';

  // Mark status
  transaction.status = nextStatus;
  transaction.statusReason = isReversing ? (reason || 'Transaction reversed') : 'Reversal undone / Re-activated';
  await transaction.save();

  // Update rent record to adjust totalPaid
  const rentRecord = await MonthlyRentRecord.findById(transaction.rentRecordId);
  if (rentRecord) {
    if (isReversing) {
      rentRecord.totalPaid = Math.max(0, rentRecord.totalPaid - transaction.amount);
    } else {
      rentRecord.totalPaid += transaction.amount;
    }
    await rentRecord.save();
  }

  logger.info(`[TRANSACTION] Status toggled for txnId=${transactionId} to=${nextStatus} amount=₹${transaction.amount}`);

  if (caller.role === 'owner') {
    const actionType = isReversing ? 'PAYMENT_TRANSACTION_REVERSED' : 'PAYMENT_TRANSACTION_REACTIVATED';
    await logActivity(
      caller.id,
      actionType,
      transaction._id,
      'PaymentTransaction',
      isReversing
        ? `Reversed transaction of ₹${transaction.amount}. Reason: ${reason}`
        : `Undid reversal of transaction of ₹${transaction.amount}`
    ).catch(err => logger.error(`Failed to log activity: ${err.message}`));
  }

  return transaction;
};

// ─────────────────────────────────────────────────────────────────────────
// UTILITY: Calculate status based on amounts (called by pre-save hook)
// ─────────────────────────────────────────────────────────────────────────

const calculateStatus = (totalRent, totalPaid, dueDate) => {
  const remaining = totalRent - totalPaid;
  const now = new Date();

  if (remaining === 0) {
    return 'paid';
  } else if (totalPaid > 0 && remaining > 0) {
    return 'partial';
  } else if (dueDate && now > dueDate && remaining > 0) {
    return 'overdue';
  }
  return 'pending';
};

module.exports = {
  ensureMonthlyRentRecord,
  addPaymentTransaction,
  getMonthlyRentRecordWithTransactions,
  getRentRecordsByOwner,
  getRentRecordsByTenant,
  updateMonthlyRentRecord,
  reverseTransaction,
  calculateStatus,
};
