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
const { generateMonthlyBillingPeriod } = require('../utils/billingHelpers');
const billingCalculationService = require('../utils/billingCalculationService');

const DEFAULT_RENT_DUE_DAY = parseInt(process.env.DEFAULT_RENT_DUE_DAY || '5', 10);

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

  // Pre-calculate Proration Math using Strict Calculation Service
  const [year, monthNum] = month.split('-').map(Number);
  const dueDate = billingCalculationService.calculateDueDate(month);
  
  const joinDate = new Date(tenant.moveInDate || tenant.joinDate || Date.now());
  const exitDate = tenant.exitDate ? new Date(tenant.exitDate) : null;
  
  const { occupiedDays, totalDays, isProrated } = billingCalculationService.calculateOccupiedDays(month, joinDate, exitDate);
  
  let finalRent = totalRent;
  let billingType = 'full';
  let proratedDays = null;

  if (isProrated) {
    finalRent = billingCalculationService.calculateProratedRent(totalRent, occupiedDays, totalDays);
    proratedDays = occupiedDays;
    
    const joinMonthStr = joinDate.toISOString().slice(0, 7);
    const exitMonthStr = exitDate ? exitDate.toISOString().slice(0, 7) : null;
    
    if (exitMonthStr === month) {
      billingType = 'prorated_moveout';
    } else if (month === joinMonthStr) {
      billingType = 'prorated_join';
    } else if (exitDate) {
      billingType = 'prorated_moveout';
    }
  }

  // Try to find existing record
  let rentRecord = await MonthlyRentRecord.findOne({
    tenantId,
    month,
  });

  if (!rentRecord) {
    // Create new rent record
    const { start, end } = generateMonthlyBillingPeriod(month);

    try {
      rentRecord = await MonthlyRentRecord.create({
        tenantId,
        userId: tenant.userId,
        roomId: tenant.roomId,
        propertyId: tenant.propertyId,
        ownerId: tenant.ownerId,
        month,
        totalRent: finalRent,
        rentAmountAtGeneration: finalRent, 
        fullRentAmount: totalRent,
        dueDate,
        billingMonth: month,
        billingYear: year,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        billingType,
        isProrated,
        proratedDays,
        billingModelVersion: 2,
        notes: options.notes || `System generated ${billingType} monthly rent record.`,
      });

      logger.info(`[RENT RECORD] Created rentRecordId=${rentRecord._id} for tenant=${tenantId} month=${month} type=${billingType} amount=${finalRent}`);
    } catch (createErr) {
      if (createErr.code === 11000) {
        logger.warn(`[RENT RECORD] Duplicate creation attempt for tenant=${tenantId} month=${month}, fetching existing`);
        rentRecord = await MonthlyRentRecord.findOne({ tenantId, month });
      } else {
        throw createErr;
      }
    }
  } else {
    // Phase D & E: Final Settlement Reconciliation or Rent Update on Existing Record
    let needsSave = false;

    // Recalculate if it became a prorated move-out month AFTER it was already generated
    if (isProrated && rentRecord.totalRent !== finalRent && billingType === 'prorated_moveout') {
      const { newTotalRent, advanceBalance, newStatus } = billingCalculationService.calculateFinalSettlement(rentRecord.totalPaid, finalRent);
      
      logger.info(`[FINAL SETTLEMENT] Recalculating existing record ${rentRecord._id}. OldRent=${rentRecord.totalRent}, NewRent=${newTotalRent}, Advance=${advanceBalance}`);
      
      rentRecord.totalRent = newTotalRent;
      rentRecord.advanceBalance = advanceBalance;
      rentRecord.status = newStatus;
      rentRecord.isProrated = true;
      rentRecord.proratedDays = proratedDays;
      rentRecord.billingType = billingType;
      
      needsSave = true;
    } else if (options.updateTotalRent && totalRent !== rentRecord.fullRentAmount) {
      // Normal rent increase update mid-month
      rentRecord.fullRentAmount = totalRent;
      rentRecord.totalRent = finalRent;
      needsSave = true;
      logger.info(`[RENT RECORD] Updated fullRentAmount to ${totalRent} for rentRecordId=${rentRecord._id}`);
    }
    
    // Explicit safety enforcement: Ensure legacy records without dueDate get one
    if (!rentRecord.dueDate) {
      rentRecord.dueDate = dueDate;
      needsSave = true;
    }

    if (needsSave) {
      await rentRecord.save();
    }
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
    amount: rawAmount,
    paymentMethod,
    transactionId,
    paymentDate = new Date(),
    note,
    proofImage,
    idempotencyKey,
    // New parameters for manual transaction entry classification & audit tracing
    transactionType,
    createdBy,
    createdByRole,
    entrySource,
  } = params;

  const amount = Number(rawAmount);
  logger.info(`[DEBUG addPaymentTransaction] params: ${JSON.stringify(params)} amount: ${amount}`);

  // Validation
  if (isNaN(amount) || amount <= 0) {
    const err = new Error('Amount must be a valid number greater than 0');
    err.statusCode = 400;
    throw err;
  }

  const validPaymentMethods = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    const err = new Error('Invalid payment method');
    err.statusCode = 400;
    throw err;
  }

  // Resolve transactionType and audit fields with strict fallbacks
  const resolvedTxnType = transactionType || paymentMethod;
  const validTransactionTypes = [
    'cash',
    'upi',
    'bank_transfer',
    'cheque',
    'gateway',
    'adjustment',
    'waiver',
    'advance_applied'
  ];
  if (!validTransactionTypes.includes(resolvedTxnType)) {
    const err = new Error(`Invalid transaction type: '${resolvedTxnType}'`);
    err.statusCode = 400;
    throw err;
  }

  const resolvedCreatedBy = createdBy || caller.id;
  const resolvedCreatedByRole = createdByRole || (caller.role === 'superadmin' ? 'admin' : caller.role) || 'system';
  
  let resolvedEntrySource = entrySource;
  if (!resolvedEntrySource) {
    if (caller.role === 'tenant') resolvedEntrySource = 'tenant_upload';
    else if (caller.role === 'owner') resolvedEntrySource = 'owner_manual';
    else if (caller.role === 'superadmin' || caller.role === 'admin') resolvedEntrySource = 'admin_manual';
    else resolvedEntrySource = 'system_generated';
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

  // Validation rules: prevent future dates too far ahead (e.g. 1 year)
  if (paymentDate && new Date(paymentDate) > new Date(Date.now() + 86400000 * 365)) {
    const err = new Error('Invalid future date');
    err.statusCode = 400;
    throw err;
  }

  const resolvedStatus = resolvedCreatedByRole === 'tenant' ? 'verifying' : 'completed';

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
      transactionType: resolvedTxnType,
      transactionId: transactionId || null,
      paymentDate,
      note,
      proofImage: proofImage || { secureUrl: null, publicId: null },
      recordedBy: caller.id,
      createdBy: resolvedCreatedBy,
      createdByRole: resolvedCreatedByRole,
      entrySource: resolvedEntrySource,
      status: resolvedStatus,
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

  logger.info(`[TRANSACTION] Created txnId=${transaction._id} rentId=${rentRecordId} amount=₹${amount} status=${resolvedStatus}`);

  // Update rent record totals only if transaction is completed immediately
  if (resolvedStatus === 'completed') {
    rentRecord.totalPaid += amount;
    await rentRecord.save(); // Pre-save hook will recalculate status, remaining, and advanceBalance

    // Automatically apply advance balance to subsequent bills
    await applyAdvanceBalance(tenantId).catch(err => logger.error(`Auto-apply advance failed: ${err.message}`));
  }

  if (caller.role === 'owner') {
    await logActivity(
      caller.id,
      'PAYMENT_TRANSACTION_ADDED',
      transaction._id,
      'PaymentTransaction',
      `Added ₹${amount} via ${paymentMethod} (${resolvedTxnType}) to month ${rentRecord.month}`
    ).catch(err => logger.error(`Failed to log activity: ${err.message}`));
  }

  // Send email notifications
  try {
    const populated = await rentRecord.populate('userId propertyId roomId ownerId');
    if (resolvedStatus === 'verifying') {
      // Notify owner about tenant payment proof upload
      if (populated.ownerId && populated.ownerId.email && populated.userId) {
        await emailService.sendPaymentProofNotification(
          populated.ownerId,        // owner
          populated.userId,         // tenant
          transaction,              // payment (transaction)
          populated.propertyId,     // property
          populated.roomId          // room
        );
      }
    } else {
      // Notify tenant about successful payment record receipt
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
    }
  } catch (emailErr) {
    logger.error(`[EMAIL] Failed to send transaction/proof notification: ${emailErr.message}`);
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
    .populate('ownerId', 'name email upiId upiNumber bankDetails qrCodeImage')
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
  if (process.env.LEDGER_V3_ENABLED === 'true') {
    const { enqueueRebuild } = require('./ledgerQueueService');
    await enqueueRebuild({
      tenantId: transaction.tenantId,
      triggerSource: isReversing ? 'transaction_reversed' : 'transaction_created',
      priority: 'high'
    });
  } else {
    const rentRecord = await MonthlyRentRecord.findById(transaction.rentRecordId);
    if (rentRecord) {
      if (isReversing) {
        rentRecord.totalPaid = Math.max(0, rentRecord.totalPaid - transaction.amount);
      } else {
        rentRecord.totalPaid += transaction.amount;
      }
      await rentRecord.save();
    }
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
// UTILITY: Chronologically distribute advance balances to subsequent outstanding rent records
// ─────────────────────────────────────────────────────────────────────────

const applyAdvanceBalance = async (tenantId) => {
  if (process.env.LEDGER_V3_ENABLED === 'true') {
    const { enqueueRebuild } = require('./ledgerQueueService');
    await enqueueRebuild({
      tenantId,
      triggerSource: 'transaction_created',
      priority: 'normal'
    });
    return;
  }

  const records = await MonthlyRentRecord.find({ tenantId }).sort({ month: 1 });
  if (records.length <= 1) return;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.advanceBalance <= 0) continue;

    // Find ANY records with remaining balances (oldest first)
    for (let j = 0; j < records.length; j++) {
      if (i === j) continue; // Don't apply to itself

      const nextRec = records[j];
      const remaining = nextRec.totalRent - nextRec.totalPaid;
      if (remaining <= 0) continue;

      const applyAmount = Math.min(rec.advanceBalance, remaining);
      if (applyAmount <= 0) continue;

      // Create system-generated advance_applied transaction on the receiving month
      await PaymentTransaction.create({
        rentRecordId: nextRec._id,
        tenantId,
        ownerId: nextRec.ownerId,
        propertyId: nextRec.propertyId,
        amount: applyAmount,
        paymentMethod: 'other',
        transactionType: 'advance_applied',
        note: `Auto-applied advance from month ${rec.month}`,
        recordedBy: rec.ownerId,
        createdBy: rec.ownerId,
        createdByRole: 'system',
        entrySource: 'auto_adjustment',
        status: 'completed'
      });

      // Update receiving balance
      nextRec.totalPaid += applyAmount;
      await nextRec.save();

      // Create system-generated advance_deducted transaction on the source month
      // This ensures sum(transactions) == totalPaid
      await PaymentTransaction.create({
        rentRecordId: rec._id,
        tenantId,
        ownerId: rec.ownerId,
        propertyId: rec.propertyId,
        amount: -applyAmount, // Negative amount to deduct
        paymentMethod: 'other',
        transactionType: 'advance_deducted',
        note: `Advance transferred to month ${nextRec.month}`,
        recordedBy: rec.ownerId,
        createdBy: rec.ownerId,
        createdByRole: 'system',
        entrySource: 'auto_adjustment',
        status: 'completed'
      });

      // Deduct from source to maintain global income consistency and prevent double-counting
      rec.totalPaid -= applyAmount;
      await rec.save();

      if (rec.advanceBalance <= 0) break;
    }
  }
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

/**
 * verifyTransaction(transactionId, caller)
 * Marks a 'verifying' transaction as 'completed' and credits it to the MonthlyRentRecord
 */
const verifyTransaction = async (transactionId, caller) => {
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

  if (transaction.status !== 'verifying') {
    const err = new Error('Only transactions in verifying status can be verified');
    err.statusCode = 400;
    throw err;
  }

  // Update status to completed
  transaction.status = 'completed';
  transaction.statusReason = 'Verified by owner';
  await transaction.save();

  // Apply to rent record
  const rentRecord = await MonthlyRentRecord.findById(transaction.rentRecordId);
  if (rentRecord) {
    rentRecord.totalPaid += transaction.amount;
    await rentRecord.save();

    // Automatically apply advance balance to subsequent bills
    await applyAdvanceBalance(transaction.tenantId).catch(err => logger.error(`Auto-apply advance failed: ${err.message}`));
  }

  if (caller.role === 'owner') {
    await logActivity(
      caller.id,
      'PAYMENT_TRANSACTION_VERIFIED',
      transaction._id,
      'PaymentTransaction',
      `Verified payment of ₹${transaction.amount} for month ${rentRecord?.month || ''}`
    ).catch(err => logger.error(`Failed to log activity: ${err.message}`));
  }

  // Send status email to tenant
  try {
    if (rentRecord) {
      const populated = await rentRecord.populate('userId propertyId roomId ownerId');
      if (populated.userId && populated.userId.email) {
        await emailService.sendPaymentStatusNotification(
          populated.userId,
          transaction,
          populated.propertyId,
          populated.roomId,
          populated.ownerId
        );
      }
    }
  } catch (emailErr) {
    logger.error(`[EMAIL] Failed to send payment verified notification to tenant: ${emailErr.message}`);
  }

  return transaction;
};

/**
 * rejectTransaction(transactionId, reason, caller)
 * Marks a 'verifying' transaction as 'failed' (rejected)
 */
const rejectTransaction = async (transactionId, reason, caller) => {
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

  if (transaction.status !== 'verifying') {
    const err = new Error('Only transactions in verifying status can be rejected');
    err.statusCode = 400;
    throw err;
  }

  // Update status to failed
  transaction.status = 'failed';
  transaction.statusReason = reason || 'Rejected by owner';
  await transaction.save();

  if (caller.role === 'owner') {
    await logActivity(
      caller.id,
      'PAYMENT_TRANSACTION_REJECTED',
      transaction._id,
      'PaymentTransaction',
      `Rejected payment of ₹${transaction.amount}. Reason: ${reason}`
    ).catch(err => logger.error(`Failed to log activity: ${err.message}`));
  }

  // Send status email to tenant
  try {
    const rentRecord = await MonthlyRentRecord.findById(transaction.rentRecordId);
    if (rentRecord) {
      const populated = await rentRecord.populate('userId propertyId roomId ownerId');
      if (populated.userId && populated.userId.email) {
        await emailService.sendPaymentStatusNotification(
          populated.userId,
          transaction,
          populated.propertyId,
          populated.roomId,
          populated.ownerId
        );
      }
    }
  } catch (emailErr) {
    logger.error(`[EMAIL] Failed to send payment rejected notification to tenant: ${emailErr.message}`);
  }

  return transaction;
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
  applyAdvanceBalance,
  verifyTransaction,
  rejectTransaction,
};
