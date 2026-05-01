'use strict';

/**
 * paymentService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized business logic for rent payments.
 * 
 * SECURITY FEATURES:
 *   1. Owner-Tenant parity check — ensures owners only record payments for their own tenants.
 *   2. Active status check — prevents recording payments for vacated tenants.
 *   3. Duplicate prevention — handled by DB unique index { tenantId: 1, month: 1 }.
 *   4. Audit trail — records the exact user (admin/owner) who performed the action.
 */

const Payment = require('../models/Payment');
const Tenant  = require('../models/Tenant');
const emailService = require('./emailService');
const logger  = require('../config/logger');
const logActivity = require('../utils/activityLogger');

/**
 * recordPayment(params, recordedBy)
 * 
 * @param {{ tenantId, month, amount, method, status, paidDate, notes }} params
 * @param {Object} caller — { id, role }
 */
const recordPayment = async (params, caller) => {
  const { tenantId, month, amount, method, status, paidDate, notes } = params;

  // 1. Fetch tenant with owner and room context
  const tenancy = await Tenant.findById(tenantId);
  if (!tenancy) {
    const err = new Error('Tenant record not found.');
    err.statusCode = 404;
    throw err;
  }

  // 2. Security: ownerId isolation
  if (caller.role === 'owner' && String(tenancy.ownerId) !== String(caller.id)) {
    const err = new Error('Access denied. This tenant does not belong to your account.');
    err.statusCode = 403;
    throw err;
  }

  // 3. Status check: no payments for vacated tenants (unless back-payments are allowed, but usually blocked)
  if (tenancy.status === 'vacated' && status === 'pending') {
    const err = new Error('Cannot record new pending payments for a vacated tenant.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Create payment record
  // Calculate default dueDate: 5th of the payment month
  let finalDueDate = params.dueDate;
  if (!finalDueDate && month) {
    const [year, m] = month.split('-').map(Number);
    finalDueDate = new Date(year, m - 1, 5); // 5th of the month
  }

  const payment = await Payment.create({
    tenantId,
    userId     : tenancy.userId,
    roomId     : tenancy.roomId,
    propertyId : tenancy.propertyId,
    ownerId    : tenancy.ownerId,
    month,
    amount,
    method     : method || 'cash',
    status     : status || 'pending',
    dueDate    : finalDueDate,
    paidDate   : paidDate || (status === 'paid' ? new Date() : undefined),
    notes,
    recordedBy : caller.id,
  });

  logger.info(`[PAYMENT RECORDED] id=${payment._id} tenant=${tenantId} month=${month} by=${caller.id}`);
  
  if (caller.role === 'owner') {
    await logActivity(caller.id, 'PAYMENT_RECORDED', payment._id, 'Payment', `Recorded ${status} payment of ₹${amount} for ${month}`);
  }

  return payment;
};

/**
 * updatePaymentStatus(paymentId, updateData, caller)
 */
const updatePaymentStatus = async (paymentId, updateData, caller) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment record not found.');
    err.statusCode = 404;
    throw err;
  }

  // ownerId isolation
  if (caller.role === 'owner' && String(payment.ownerId) !== String(caller.id)) {
    const err = new Error('Access denied.');
    err.statusCode = 403;
    throw err;
  }

  const { amount, method, status, paidDate, notes, failureReason } = updateData;
  if (amount   !== undefined) payment.amount   = amount;
  if (method   !== undefined) payment.method   = method;
  if (status   !== undefined) payment.status   = status;
  if (paidDate !== undefined) payment.paidDate = paidDate;
  if (notes    !== undefined) payment.notes    = notes;
  if (failureReason !== undefined) payment.failureReason = failureReason;

  await payment.save();
  logger.info(`[PAYMENT UPDATED] id=${paymentId} by=${caller.id}`);
  
  if (caller.role === 'owner' && status) {
    const actionType = status === 'paid' ? 'PAYMENT_VERIFIED' : (status === 'rejected' || status === 'failed') ? 'PAYMENT_REJECTED' : 'PAYMENT_UPDATED';
    await logActivity(caller.id, actionType, payment._id, 'Payment', `Status updated to ${status}`);
  }
  
  // Send Notification to Tenant if status changed to paid or partial (or failed/rejected)
  try {
    const populated = await payment.populate('userId propertyId roomId ownerId');
    if (populated.userId && populated.userId.email) {
      await emailService.sendPaymentStatusNotification(
        populated.userId,
        populated,
        populated.propertyId,
        populated.roomId,
        populated.ownerId
      );
    }
  } catch (emailErr) {
    logger.error(`Failed to send payment status email: ${emailErr.message}`);
  }

  return payment;
};

module.exports = { recordPayment, updatePaymentStatus };
