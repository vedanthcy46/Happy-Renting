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
const notificationService = require('./notificationService');
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
  const tenant = options.tenant || await Tenant.findById(tenantId);
  if (!tenant) {
    const err = new Error('Tenant not found');
    err.statusCode = 404;
    throw err;
  }

  if (['deleted', 'pending_deletion', 'deletion_requested'].includes(tenant.status)) {
    const err = new Error(`Cannot create rent record for tenant with status ${tenant.status}`);
    err.statusCode = 400;
    throw err;
  }

  if (tenant.status === 'vacated' && !options.allowVacated) {
    const err = new Error('Cannot create rent record for vacated tenant');
    err.statusCode = 400;
    throw err;
  }

  if (tenant.exitDate) {
    const exitDate = new Date(tenant.exitDate);
    const exitMonthStr = exitDate.toISOString().slice(0, 7);
    if (month > exitMonthStr) {
      const err = new Error(`Cannot create rent record for month ${month} after tenant exit date ${exitMonthStr}`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Pre-calculate Proration Math using Strict Calculation Service
  const [year, monthNum] = month.split('-').map(Number);

  // POSTPAID billing: a bill for occupancy `month` is generated in the
  // following month (e.g. a July bill is generated in August). Its rent is
  // therefore due on the 5th of THAT following month, not the 5th of the
  // (already passed) occupancy month. Anchoring to the occupancy month would
  // make every generated bill instantly overdue.
  let dueYear = year;
  let dueMonthNum = monthNum + 1;
  if (dueMonthNum > 12) {
    dueMonthNum = 1;
    dueYear = year + 1;
  }
  const dueMonthStr = `${dueYear}-${String(dueMonthNum).padStart(2, '0')}`;
  const dueDate = billingCalculationService.calculateDueDate(dueMonthStr);
  
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
      
      // Send Mobile Push Notification
      if (tenant.userId) {
        notificationService.sendPushNotification({
          userId: tenant.userId,
          title: 'New Rent Bill Generated 📄',
          message: `Your rent bill for ${month} has been generated.`,
          type: 'bill_generated',
          data: { rentRecordId: rentRecord._id, month }
        }).catch(err => logger.error(`[Push] Failed to send bill generation push: ${err.message}`));
      }
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
    await applyAdvanceBalance(tenantId, transaction._id).catch(err => logger.error(`Auto-apply advance failed: ${err.message}`));
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

      notificationService.sendPushNotification({
        userId: populated.ownerId._id,
        title: 'Payment Proof Uploaded',
        body: `${populated.userId.name} uploaded a payment proof of ₹${transaction.amount}.`,
        type: 'payment_proof_uploaded',
        data: { transactionId: transaction._id }
      }).catch(err => logger.error(`[Push] Failed: ${err.message}`));
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
    .populate('ownerId', 'name email upiId upiNumber bankDetails qrCodeImage upiDetails')
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
    if (!['pending', 'partial', 'paid', 'overdue', 'waived'].includes(status)) {
      const err = new Error('Invalid status value. Must be pending, partial, paid, overdue, or waived.');
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
 * unwindAdvanceDistribution(transaction, sourceRecord)
 * When an overpaid payment is reversed, the system-generated advance_applied /
 * advance_deducted transactions it spawned must also be reversed so pending
 * months fall back to their true outstanding balance instead of keeping the
 * now-gone advance.
 */
const unwindAdvanceDistribution = async (transaction, sourceRecord) => {
  let applied = await PaymentTransaction.find({
    tenantId: transaction.tenantId,
    transactionType: 'advance_applied',
    sourceTransactionId: transaction._id,
    status: 'completed',
  });

  // Legacy fallback (rows created before sourceTransactionId existed):
  // match by the source month referenced in the note.
  if (applied.length === 0 && sourceRecord) {
    const monthStr = String(sourceRecord.month || '').trim();
    if (monthStr) {
      const esc = monthStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      applied = await PaymentTransaction.find({
        tenantId: transaction.tenantId,
        transactionType: 'advance_applied',
        status: 'completed',
        sourceTransactionId: { $exists: false },
        note: { $regex: new RegExp(`from month ${esc}$`), $options: 'i' },
      });
    }
  }

  if (applied.length === 0) return;

  const reason = `Advance unwound - source payment reversed (txn ${transaction._id})`;

  for (const app of applied) {
    // 1. Receiving month loses the advance credit
    const recv = await MonthlyRentRecord.findById(app.rentRecordId);
    if (recv) {
      recv.totalPaid = Math.max(0, recv.totalPaid - app.amount);
      await recv.save();
    }

    // 2. Find the system advance_deducted row(s) spawned from THIS advance.
    //    One source payment can fund several months, and every deducted row
    //    shares the same sourceTransactionId + source rentRecordId, so match
    //    precisely by the receiving month referenced in the note.
    const receivingMonth = recv ? String(recv.month || '').trim() : '';
    const baseQuery = {
      tenantId: transaction.tenantId,
      transactionType: 'advance_deducted',
      status: 'completed',
      rentRecordId: sourceRecord ? sourceRecord._id : app.rentRecordId,
      ...(app.sourceTransactionId
        ? { sourceTransactionId: app.sourceTransactionId }
        : { sourceTransactionId: { $exists: false } }),
    };
    let deductedRows = [];
    if (receivingMonth) {
      const esc = receivingMonth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      deductedRows = await PaymentTransaction.find({
        ...baseQuery,
        note: { $regex: new RegExp(`Advance transferred to month ${esc}$`), $options: 'i' },
      });

      // Legacy fallback: a deducted row whose note references the receiving month
      if (deductedRows.length === 0) {
        deductedRows = await PaymentTransaction.find({
          ...baseQuery,
          note: { $regex: new RegExp(`month ${esc}$`), $options: 'i' },
        });
      }
    }
    // Only fall back to sourceTransactionId matching when there is a single
    // advance application, otherwise the pairing is ambiguous and risks
    // restoring the same deduction more than once.
    if (deductedRows.length === 0 && applied.length === 1) {
      deductedRows = await PaymentTransaction.find(baseQuery);
    }

    // Only restore the amount for rows that are actually being reversed so the
    // source month's totalPaid never gets inflated twice.
    const restoreAmount = deductedRows.reduce((sum, d) => sum + Math.abs(d.amount), 0) || Math.abs(app.amount);
    if (sourceRecord && sourceRecord.totalPaid != null) {
      sourceRecord.totalPaid = Math.max(0, sourceRecord.totalPaid + restoreAmount);
    }

    // 3. Reverse every matching advance_deducted row (updateMany, never one)
    await PaymentTransaction.updateMany(
      { _id: { $in: deductedRows.map(r => r._id) } },
      { $set: { status: 'reversed', statusReason: reason } }
    );

    // 4. Reverse the advance_applied transaction itself
    app.status = 'reversed';
    app.statusReason = reason;
    await app.save();
  }

  if (sourceRecord) await sourceRecord.save();

  logger.info(
    `[TRANSACTION] Unwound ${applied.length} advance application(s) for tenant ${transaction.tenantId}`
  );
};

/**
 * reapplyAdvanceDistribution(transaction, sourceRecord)
 * Mirror of unwindAdvanceDistribution. When a reversed overpaid payment is
 * re-activated (undo reversal), the advance_applied / advance_deducted rows it
 * spawned must be re-applied so every other month the overpayment had
 * auto-adjusted regains its credit and falls back to the correct outstanding
 * balance.
 */
const reapplyAdvanceDistribution = async (transaction, sourceRecord) => {
  let applied = await PaymentTransaction.find({
    tenantId: transaction.tenantId,
    transactionType: 'advance_applied',
    sourceTransactionId: transaction._id,
    status: 'reversed',
  });

  // Legacy fallback (rows created before sourceTransactionId existed):
  // match by the source month referenced in the note.
  if (applied.length === 0 && sourceRecord) {
    const monthStr = String(sourceRecord.month || '').trim();
    if (monthStr) {
      const esc = monthStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      applied = await PaymentTransaction.find({
        tenantId: transaction.tenantId,
        transactionType: 'advance_applied',
        status: 'reversed',
        sourceTransactionId: { $exists: false },
        note: { $regex: new RegExp(`from month ${esc}$`), $options: 'i' },
      });
    }
  }

  if (applied.length === 0) return;

  const reason = 'Reversal undone / Re-activated';

  for (const app of applied) {
    // 1. Receiving month regains the advance credit
    const recv = await MonthlyRentRecord.findById(app.rentRecordId);
    if (recv) {
      recv.totalPaid = Math.max(0, recv.totalPaid + Math.abs(app.amount));
      await recv.save();
    }

    // 2. Find the system advance_deducted row(s) spawned from THIS advance.
    //    One source payment can fund several months, and every deducted row
    //    shares the same sourceTransactionId + source rentRecordId, so match
    //    precisely by the receiving month referenced in the note.
    const receivingMonth = recv ? String(recv.month || '').trim() : '';
    const baseQuery = {
      tenantId: transaction.tenantId,
      transactionType: 'advance_deducted',
      status: 'reversed',
      rentRecordId: sourceRecord ? sourceRecord._id : app.rentRecordId,
      ...(app.sourceTransactionId
        ? { sourceTransactionId: app.sourceTransactionId }
        : { sourceTransactionId: { $exists: false } }),
    };
    let deductedRows = [];
    if (receivingMonth) {
      const esc = receivingMonth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      deductedRows = await PaymentTransaction.find({
        ...baseQuery,
        note: { $regex: new RegExp(`Advance transferred to month ${esc}$`), $options: 'i' },
      });

      // Legacy fallback: a deducted row whose note references the receiving month
      if (deductedRows.length === 0) {
        deductedRows = await PaymentTransaction.find({
          ...baseQuery,
          note: { $regex: new RegExp(`month ${esc}$`), $options: 'i' },
        });
      }
    }
    // Only fall back to sourceTransactionId matching when there is a single
    // advance application, otherwise the pairing is ambiguous and risks
    // re-deducting the same amount more than once.
    if (deductedRows.length === 0 && applied.length === 1) {
      deductedRows = await PaymentTransaction.find(baseQuery);
    }

    // Only remove the amount for rows that are actually being re-applied so the
    // source month's totalPaid never gets deflated twice.
    const restoreAmount = deductedRows.reduce((sum, d) => sum + Math.abs(d.amount), 0) || Math.abs(app.amount);
    if (sourceRecord && sourceRecord.totalPaid != null) {
      sourceRecord.totalPaid = Math.max(0, sourceRecord.totalPaid - restoreAmount);
    }

    // 3. Reactivate every matching advance_deducted row (updateMany, never one)
    await PaymentTransaction.updateMany(
      { _id: { $in: deductedRows.map(r => r._id) } },
      { $set: { status: 'completed', statusReason: reason } }
    );

    // 4. Reactivate the advance_applied transaction itself
    app.status = 'completed';
    app.statusReason = reason;
    await app.save();
  }

  if (sourceRecord) await sourceRecord.save();

  logger.info(
    `[TRANSACTION] Re-applied ${applied.length} advance application(s) for tenant ${transaction.tenantId}`
  );
};

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

  // System-generated advance rows are reversed automatically as part of unwinding
  // their source payment. Reversing them in isolation corrupts totalPaid because
  // they carry a negative amount (advance_deducted).
  if (
    transaction.transactionType === 'advance_applied' ||
    transaction.transactionType === 'advance_deducted'
  ) {
    const err = new Error('Auto-adjusted transactions are reversed through their source payment');
    err.statusCode = 400;
    throw err;
  }

  const isReversing = transaction.status === 'completed';
  const nextStatus = isReversing ? 'reversed' : 'completed';

  // Mark status
  transaction.status = nextStatus;
  transaction.statusReason = isReversing ? (reason || 'Transaction reversed') : 'Reversal undone / Re-activated';
  await transaction.save();

  // Update rent records: when reversing an overpaid payment, first unwind any
  // auto-applied advance it spawned, then adjust the source month's totalPaid.
  const rented = await MonthlyRentRecord.findById(transaction.rentRecordId);
  if (isReversing && rented && transaction.transactionType !== 'waiver') {
    await unwindAdvanceDistribution(transaction, rented).catch(err =>
      logger.error(`Failed to unwind advance distribution: ${err.message}`)
    );
  }

  if (process.env.LEDGER_V3_ENABLED === 'true') {
    const { enqueueRebuild } = require('./ledgerQueueService');
    await enqueueRebuild({
      tenantId: transaction.tenantId,
      triggerSource: isReversing ? 'transaction_reversed' : 'transaction_created',
      priority: 'high'
    });
  } else {
    if (rented) {
      // Waiver transactions affect waivedAmount, not totalPaid
      if (transaction.transactionType === 'waiver') {
        if (isReversing) {
          rented.waivedAmount = Math.max(0, (rented.waivedAmount || 0) - transaction.amount);
          // Clean up waiver metadata when no waivers remain
          if (rented.waivedAmount <= 0) {
            rented.waivedAmount = 0;
            rented.waivedBy = undefined;
            rented.waivedAt = undefined;
            rented.waiverReason = undefined;
            rented.waiverNotes = undefined;
          }
        } else {
          rented.waivedAmount = (rented.waivedAmount || 0) + transaction.amount;
        }
      } else {
        if (isReversing) {
          rented.totalPaid = Math.max(0, rented.totalPaid - transaction.amount);
        } else {
          // Undo: re-add the payment first, then re-activate the auto-adjusted
          // advance rows that were unwound on reversal so every other month the
          // overpayment had adjusted regains its credit. Order matters: the
          // re-applied deductions are subtracted against a positive balance.
          rented.totalPaid += transaction.amount;
          await reapplyAdvanceDistribution(transaction, rented).catch(err =>
            logger.error(`Failed to reapply advance distribution: ${err.message}`)
          );
        }
      }
      await rented.save();
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

const applyAdvanceBalance = async (tenantId, sourceTransactionId) => {
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
        sourceTransactionId: sourceTransactionId || null,
        status: 'completed'
      });
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
        sourceTransactionId: sourceTransactionId || null,
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
    await applyAdvanceBalance(transaction.tenantId, transaction._id).catch(err => logger.error(`Auto-apply advance failed: ${err.message}`));
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
      if (populated.userId) {
        if (populated.userId.email) {
          await emailService.sendPaymentStatusNotification(
            populated.userId,
            transaction,
            populated.propertyId,
            populated.roomId,
            populated.ownerId
          );
        }
        
        // Mobile Push Notification
        await notificationService.sendPushNotification({
          userId: populated.userId._id,
          title: 'Payment Verified ✅',
          body: `Your manual payment of ₹${transaction.amount} has been verified by the owner.`,
          type: 'payment_verified',
          data: { transactionId: transaction._id }
        }).catch(err => logger.error(`[Push] Failed to send push: ${err.message}`));
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
      if (populated.userId) {
        if (populated.userId.email) {
          await emailService.sendPaymentStatusNotification(
            populated.userId,
            transaction,
            populated.propertyId,
            populated.roomId,
            populated.ownerId
          );
        }

        // Mobile Push Notification
        await notificationService.sendPushNotification({
          userId: populated.userId._id,
          title: 'Payment Rejected ❌',
          body: `Your manual payment of ₹${transaction.amount} was rejected. Reason: ${reason || 'Not specified'}`,
          type: 'payment_rejected',
          data: { transactionId: transaction._id }
        }).catch(err => logger.error(`[Push] Failed to send push: ${err.message}`));
      }
    }
  } catch (emailErr) {
    logger.error(`[EMAIL] Failed to send payment rejected notification to tenant: ${emailErr.message}`);
  }

  return transaction;
};

// ─────────────────────────────────────────────────────────────────────────
// ACTION: Waive charge (full or partial)
// ─────────────────────────────────────────────────────────────────────────

/**
 * waiveCharge(rentRecordId, params, caller)
 * Creates an auditable waiver record on a rent record.
 * The original record is preserved; status transitions to 'waived' (full)
 * or adjusts remaining for partial waivers.
 */
const waiveCharge = async (rentRecordId, params, caller) => {
  const { waiveAmount, reason, notes } = params;

  // Only owners and superadmins can waive
  if (!['owner', 'superadmin'].includes(caller.role)) {
    const err = new Error('Only owners can waive charges');
    err.statusCode = 403;
    throw err;
  }

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

  // Cannot waive already waived or fully paid records
  if (rentRecord.status === 'waived') {
    const err = new Error('This record is already fully waived');
    err.statusCode = 400;
    throw err;
  }

  // Calculate the outstanding amount (totalRent - already waived - already paid)
  const alreadyWaived = rentRecord.waivedAmount || 0;
  const outstanding = rentRecord.totalRent - alreadyWaived - rentRecord.totalPaid;

  if (outstanding <= 0) {
    const err = new Error('Nothing left to waive on this record');
    err.statusCode = 400;
    throw err;
  }

  // Determine waiver amount
  const amountToWaive = waiveAmount ? Number(waiveAmount) : outstanding;

  if (isNaN(amountToWaive) || amountToWaive <= 0) {
    const err = new Error('Invalid waiver amount');
    err.statusCode = 400;
    throw err;
  }

  if (amountToWaive > outstanding) {
    const err = new Error(`Cannot waive ₹${amountToWaive}. Only ₹${outstanding} is outstanding.`);
    err.statusCode = 400;
    throw err;
  }

  const validReasons = ['owner_concession', 'free_month', 'promotional', 'maintenance_adjustment', 'other'];
  if (reason && !validReasons.includes(reason)) {
    const err = new Error('Invalid waiver reason');
    err.statusCode = 400;
    throw err;
  }

  // Create audit trail — a waiver transaction with negative amount (credit to tenant)
  const transaction = await PaymentTransaction.create({
    rentRecordId: rentRecord._id,
    tenantId: rentRecord.tenantId,
    ownerId: rentRecord.ownerId,
    propertyId: rentRecord.propertyId,
    amount: amountToWaive,
    paymentMethod: 'other',
    transactionType: 'waiver',
    note: notes || `Charge waived: ${reason || 'Not specified'}`,
    recordedBy: caller.id,
    createdBy: caller.id,
    createdByRole: caller.role === 'superadmin' ? 'admin' : 'owner',
    entrySource: 'owner_manual',
    status: 'completed',
  });

  // Update rent record with waiver info
  rentRecord.waivedAmount = alreadyWaived + amountToWaive;
  rentRecord.waivedBy = caller.id;
  rentRecord.waivedAt = new Date();
  if (reason) rentRecord.waiverReason = reason;
  if (notes) rentRecord.waiverNotes = notes;

  await rentRecord.save(); // pre-save hook recalculates remainingAmount and status

  logger.info(
    `[WAIVER] rentRecordId=${rentRecordId} amount=₹${amountToWaive} totalWaived=₹${rentRecord.waivedAmount} by=${caller.id}`
  );

  await logActivity(
    caller.id,
    'CHARGE_WAIVED',
    transaction._id,
    'PaymentTransaction',
    `Waived ₹${amountToWaive} for month ${rentRecord.month}. Reason: ${reason || 'Not specified'}`
  ).catch(err => logger.error(`Failed to log activity: ${err.message}`));

  // Notify tenant
  try {
    const populated = await rentRecord.populate('userId propertyId roomId ownerId');
    if (populated.userId && populated.userId.email) {
      await emailService.sendChargeWaivedNotification(
        populated.userId,
        rentRecord,
        populated.propertyId,
        populated.roomId,
        populated.ownerId,
        { amount: amountToWaive, reason, notes }
      ).catch(err => logger.error(`[EMAIL] Waiver notification failed: ${err.message}`));
    }

    notificationService.sendPushNotification({
      userId: populated.userId._id,
      title: 'Charge Waived',
      body: `₹${amountToWaive} of your ${formatMonth(rentRecord.month)} rent has been waived by the owner.`,
      type: 'charge_waived',
      data: { rentRecordId: rentRecord._id }
    }).catch(err => logger.error(`[Push] Failed: ${err.message}`));
  } catch (err) {
    logger.error(`[WAIVER] Notification error: ${err.message}`);
  }

  return { transaction, rentRecord };
};

/**
 * Helper to format month string (YYYY-MM) to display format
 */
const formatMonth = (month) => {
  if (!month) return '';
  const [year, m] = month.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
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
  waiveCharge,
};
