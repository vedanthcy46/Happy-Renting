'use strict';

/**
 * monthlyBillController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the invoice layer (MonthlyBill) for the monthly billing system.
 * The payment/ledger side (MonthlyRentRecord + PaymentTransaction) is unchanged.
 *
 * Flow:
 *   1. Owner creates a DRAFT bill (auto-populated with recurring charges + rent)
 *   2. Owner adds variable charges (electricity, repairs, etc.)
 *   3. Owner publishes the bill → MonthlyRentRecord.totalRent is synced
 *   4. Tenant sees one unified bill and pays via existing payment system
 */

const mongoose = require('mongoose');
const MonthlyBill = require('../models/MonthlyBill');
const RecurringCharge = require('../models/RecurringCharge');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const Tenant = require('../models/Tenant');
const logger = require('../config/logger');
const notificationService = require('../services/notificationService');
const paymentServiceV2 = require('../services/paymentServiceV2');

const VALID_ITEM_TYPES = ['RENT', 'ELECTRICITY', 'WATER', 'MAINTENANCE', 'INTERNET', 'GAS', 'PARKING', 'CLEANING', 'SOCIETY', 'GARBAGE', 'LATE_FEE', 'OTHER'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync the bill's totalAmount back to the linked MonthlyRentRecord.totalRent
 * so the payment ledger always reflects the correct amount owed.
 */
const syncBillToRentRecord = async (bill) => {
  if (!bill.rentRecordId) return;
  try {
    const record = await MonthlyRentRecord.findById(bill.rentRecordId);
    if (!record) return;

    const newTotal = bill.totalAmount;
    record.totalRent = newTotal;
    record.fullRentAmount = newTotal;
    record.rentAmountAtGeneration = newTotal;
    // remainingAmount is recalculated in MonthlyRentRecord pre-save hook
    await record.save();
    logger.info(`[MONTHLY BILL] Synced bill ${bill._id} totalAmount ₹${newTotal} → rentRecord ${record._id}`);
  } catch (err) {
    logger.error(`[MONTHLY BILL] Failed to sync bill to rent record: ${err.message}`);
  }
};

/**
 * Sync MonthlyRentRecord payment status back to the linked MonthlyBill.
 * Called after any payment transaction is recorded.
 */
const syncRentRecordToBill = async (rentRecordId) => {
  if (!rentRecordId) return;
  try {
    const record = await MonthlyRentRecord.findById(rentRecordId).select('status').lean();
    if (!record) return;
    const STATUS_MAP = { paid: 'PAID', overdue: 'OVERDUE', partial: 'PARTIAL', pending: 'PENDING', waived: 'WAIVED', overpaid: 'PAID' };
    const billStatus = STATUS_MAP[record.status];
    if (billStatus) {
      await MonthlyBill.updateOne(
        { rentRecordId, status: { $nin: ['DRAFT'] } },
        { $set: { status: billStatus } }
      );
    }
  } catch (err) {
    logger.error(`[MONTHLY BILL] Failed to sync rent record status to bill: ${err.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/bills — list bills
// ─────────────────────────────────────────────────────────────────────────────
const getBills = async (req, res, next) => {
  try {
    const filters = {};

    if (req.user.role === 'owner') {
      filters.ownerId = req.user._id;
    } else if (req.user.role === 'tenant') {
      const tenancies = await Tenant.find({ userId: req.user._id });
      filters.tenantId = tenancies.length
        ? { $in: tenancies.map(t => t._id) }
        : new mongoose.Types.ObjectId();
      // Tenants only see published bills
      filters.isPublished = true;
    }

    const { tenantId, propertyId, month, status } = req.query;
    if (tenantId && /^[a-f\d]{24}$/i.test(tenantId)) filters.tenantId = tenantId;
    if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) filters.propertyId = propertyId;
    if (month) filters.month = month;
    if (status) filters.status = status;

    const page  = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const [bills, total] = await Promise.all([
      MonthlyBill.find(filters)
        .populate('tenantId', 'status joinDate')
        .populate('userId', 'name email phone')
        .populate('roomId', 'roomNumber floor monthlyRent')
        .populate('propertyId', 'name address')
        .populate('ownerId', 'name email')
        .sort({ month: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MonthlyBill.countDocuments(filters),
    ]);

    res.json({ success: true, count: bills.length, total, page, pages: Math.ceil(total / limit), bills });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/bills/:billId — single bill detail
// ─────────────────────────────────────────────────────────────────────────────
const getBillDetail = async (req, res, next) => {
  try {
    const bill = await MonthlyBill.findById(req.params.billId)
      .populate('tenantId', 'status joinDate')
      .populate('userId', 'name email phone')
      .populate('roomId', 'roomNumber floor monthlyRent')
      .populate('propertyId', 'name address')
      .populate('ownerId', 'name email')
      .populate('rentRecordId', 'totalRent totalPaid remainingAmount status');

    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (req.user.role === 'owner' && String(bill.ownerId._id || bill.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'tenant' && (!bill.isPublished || String(bill.userId._id || bill.userId) !== String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, bill });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/bills — create a DRAFT bill for a tenant/month
// Auto-populates: rent item + all active recurring charges
// ─────────────────────────────────────────────────────────────────────────────
const createBill = async (req, res, next) => {
  try {
    const { tenantId, month, dueDate, notes } = req.body;

    if (!tenantId || !month || !dueDate) {
      return res.status(400).json({ success: false, message: 'tenantId, month, and dueDate are required' });
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, message: 'month must be in YYYY-MM format' });
    }

    const tenant = await Tenant.findById(tenantId).populate('roomId').populate('userId');
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    if (req.user.role === 'owner' && String(tenant.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check for existing bill
    const existing = await MonthlyBill.findOne({ tenantId, month });
    if (existing) {
      return res.status(409).json({ success: false, message: `A bill for ${month} already exists for this tenant`, bill: existing });
    }

    const monthlyRent = tenant.roomId?.monthlyRent || 0;

    // Build items: start with rent
    const items = [
      {
        type       : 'RENT',
        description: 'Monthly Rent',
        amount     : monthlyRent,
        effectiveAmount: monthlyRent,
      },
    ];

    // Auto-add active recurring charges
    const recurring = await RecurringCharge.find({ tenantId, isActive: true });
    for (const charge of recurring) {
      items.push({
        type           : charge.type,
        description    : charge.description,
        amount         : charge.amount,
        effectiveAmount: charge.amount,
      });
    }

    const bill = await MonthlyBill.create({
      tenantId,
      userId    : tenant.userId._id || tenant.userId,
      roomId    : tenant.roomId._id || tenant.roomId,
      propertyId: tenant.propertyId,
      ownerId   : tenant.ownerId,
      month,
      dueDate   : new Date(dueDate),
      items,
      notes,
      status    : 'DRAFT',
    });

    res.status(201).json({ success: true, message: 'Draft bill created', bill });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A bill for this tenant and month already exists' });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/bills/:billId/items — add a charge item to a DRAFT bill
// ─────────────────────────────────────────────────────────────────────────────
const addBillItem = async (req, res, next) => {
  try {
    const bill = await MonthlyBill.findById(req.params.billId);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (req.user.role === 'owner' && String(bill.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (bill.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Can only add items to a DRAFT bill. Use the edit endpoint for published bills.' });
    }

    const { type, description, amount, metadata } = req.body;

    if (!type || !VALID_ITEM_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${VALID_ITEM_TYPES.join(', ')}` });
    }
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ success: false, message: 'description is required' });
    }

    let finalAmount = Number(amount);

    // Auto-calculate electricity from meter readings if provided
    if (type === 'ELECTRICITY' && metadata?.previousReading != null && metadata?.currentReading != null && metadata?.ratePerUnit != null) {
      const units = metadata.currentReading - metadata.previousReading;
      if (units < 0) return res.status(400).json({ success: false, message: 'currentReading must be greater than previousReading' });
      metadata.unitsConsumed = units;
      finalAmount = parseFloat((units * metadata.ratePerUnit).toFixed(2));
    }

    if (isNaN(finalAmount) || finalAmount < 0) {
      return res.status(400).json({ success: false, message: 'amount must be a non-negative number' });
    }

    bill.items.push({ type, description, amount: finalAmount, effectiveAmount: finalAmount, metadata: metadata || null });
    await bill.save();

    res.status(201).json({ success: true, message: 'Charge added', bill });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v2/bills/:billId/items/:itemId — edit a bill item (DRAFT only)
// ─────────────────────────────────────────────────────────────────────────────
const updateBillItem = async (req, res, next) => {
  try {
    const bill = await MonthlyBill.findById(req.params.billId);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (req.user.role === 'owner' && String(bill.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (bill.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Can only edit items on a DRAFT bill' });
    }

    const item = bill.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Bill item not found' });

    const { description, amount, metadata } = req.body;
    if (description) item.description = description;
    if (metadata) item.metadata = { ...item.metadata, ...metadata };

    if (amount != null) {
      let finalAmount = Number(amount);
      if (item.type === 'ELECTRICITY' && item.metadata?.previousReading != null && item.metadata?.currentReading != null && item.metadata?.ratePerUnit != null) {
        const units = item.metadata.currentReading - item.metadata.previousReading;
        item.metadata.unitsConsumed = units;
        finalAmount = parseFloat((units * item.metadata.ratePerUnit).toFixed(2));
      }
      if (isNaN(finalAmount) || finalAmount < 0) {
        return res.status(400).json({ success: false, message: 'amount must be a non-negative number' });
      }
      item.amount = finalAmount;
    }

    await bill.save();
    res.json({ success: true, message: 'Item updated', bill });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v2/bills/:billId/items/:itemId — remove a charge (DRAFT only, non-RENT)
// ─────────────────────────────────────────────────────────────────────────────
const removeBillItem = async (req, res, next) => {
  try {
    const bill = await MonthlyBill.findById(req.params.billId);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (req.user.role === 'owner' && String(bill.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (bill.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Can only remove items from a DRAFT bill' });
    }

    const item = bill.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Bill item not found' });
    if (item.type === 'RENT') {
      return res.status(400).json({ success: false, message: 'Cannot remove the RENT line item' });
    }

    item.deleteOne();
    await bill.save();
    res.json({ success: true, message: 'Item removed', bill });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/bills/:billId/items/:itemId/waive — waive a specific line item
// The original charge is preserved; effectiveAmount becomes 0 (or reduced).
// ─────────────────────────────────────────────────────────────────────────────
const waiveBillItem = async (req, res, next) => {
  try {
    const bill = await MonthlyBill.findById(req.params.billId);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (req.user.role === 'owner' && String(bill.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (['PAID', 'WAIVED'].includes(bill.status)) {
      return res.status(400).json({ success: false, message: 'Cannot waive items on a paid or fully waived bill' });
    }

    const item = bill.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Bill item not found' });

    const { waiverReason, waivedAmount } = req.body;
    // If waivedAmount is provided, do a partial waiver; otherwise waive the full item
    const waiveAmt = waivedAmount != null ? Math.min(Number(waivedAmount), item.amount) : item.amount;

    item.isWaived = waiveAmt >= item.amount;
    item.waivedAmount = waiveAmt;
    item.waiverReason = waiverReason || null;
    item.waivedAt = new Date();

    await bill.save(); // pre-save recalculates totalAmount

    // Sync updated total to the linked rent record
    await syncBillToRentRecord(bill);

    res.json({ success: true, message: `₹${waiveAmt} waived on ${item.type} item`, bill });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/bills/:billId/publish — finalize and publish bill to tenant
// Creates/updates the MonthlyRentRecord with the bill's totalAmount.
// ─────────────────────────────────────────────────────────────────────────────
const publishBill = async (req, res, next) => {
  try {
    const bill = await MonthlyBill.findById(req.params.billId)
      .populate('tenantId')
      .populate('userId', 'name email');

    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (req.user.role === 'owner' && String(bill.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (bill.isPublished) {
      return res.status(400).json({ success: false, message: 'Bill is already published' });
    }
    if (bill.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot publish an empty bill' });
    }

    // Ensure/update the MonthlyRentRecord with the bill's totalAmount
    const rentRecord = await paymentServiceV2.ensureMonthlyRentRecord(
      bill.tenantId._id || bill.tenantId,
      bill.month,
      bill.totalAmount,
      {
        notes      : `Bill generated with ${bill.items.length} line items`,
        allowVacated: true,
        tenant     : bill.tenantId,
        dueDate    : bill.dueDate,
        updateTotalRent: true,
      }
    );

    // Always sync bill total → rent record so electricity/water/etc are included
    if (rentRecord.totalRent !== bill.totalAmount) {
      rentRecord.totalRent = bill.totalAmount;
      rentRecord.fullRentAmount = bill.totalAmount;
      rentRecord.rentAmountAtGeneration = bill.totalAmount;
      await rentRecord.save();
    }

    bill.rentRecordId = rentRecord._id;
    bill.isPublished  = true;
    bill.publishedAt  = new Date();
    bill.status       = 'PENDING';
    await bill.save();

    // Push notification to tenant
    notificationService.sendPushNotification({
      userId    : bill.userId._id || bill.userId,
      i18nKey   : 'bill.generated.title',
      i18nBodyKey: 'bill.generated.body',
      i18nVars  : { amount: bill.totalAmount, month: bill.month },
      type      : 'bill_generated',
      data      : { billId: bill._id, rentRecordId: rentRecord._id },
    }).catch(() => null);

    logger.info(`[MONTHLY BILL] Published bill ${bill._id} for tenant ${bill.tenantId._id} month=${bill.month} total=₹${bill.totalAmount}`);

    res.json({ success: true, message: 'Bill published successfully', bill, rentRecord });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v2/bills/:billId — delete a DRAFT bill
// ─────────────────────────────────────────────────────────────────────────────
const deleteBill = async (req, res, next) => {
  try {
    const bill = await MonthlyBill.findById(req.params.billId);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (req.user.role === 'owner' && String(bill.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (bill.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Only DRAFT bills can be deleted' });
    }

    await bill.deleteOne();
    res.json({ success: true, message: 'Draft bill deleted' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING CHARGES CRUD
// ─────────────────────────────────────────────────────────────────────────────

const getRecurringCharges = async (req, res, next) => {
  try {
    const filters = {};
    if (req.user.role === 'owner') filters.ownerId = req.user._id;
    if (req.query.tenantId && /^[a-f\d]{24}$/i.test(req.query.tenantId)) filters.tenantId = req.query.tenantId;

    const charges = await RecurringCharge.find(filters)
      .populate('tenantId', 'status')
      .populate('roomId', 'roomNumber')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, charges });
  } catch (err) {
    next(err);
  }
};

const createRecurringCharge = async (req, res, next) => {
  try {
    const { tenantId, type, description, amount } = req.body;

    if (!tenantId || !type || !description || amount == null) {
      return res.status(400).json({ success: false, message: 'tenantId, type, description, and amount are required' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    if (req.user.role === 'owner' && String(tenant.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const charge = await RecurringCharge.create({
      tenantId,
      ownerId   : tenant.ownerId,
      propertyId: tenant.propertyId,
      roomId    : tenant.roomId,
      type,
      description,
      amount    : Number(amount),
    });

    res.status(201).json({ success: true, message: 'Recurring charge created', charge });
  } catch (err) {
    next(err);
  }
};

const updateRecurringCharge = async (req, res, next) => {
  try {
    const charge = await RecurringCharge.findById(req.params.chargeId);
    if (!charge) return res.status(404).json({ success: false, message: 'Recurring charge not found' });

    if (req.user.role === 'owner' && String(charge.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { description, amount, isActive } = req.body;
    if (description != null) charge.description = description;
    if (amount != null) charge.amount = Number(amount);
    if (isActive != null) charge.isActive = Boolean(isActive);

    await charge.save();
    res.json({ success: true, message: 'Recurring charge updated', charge });
  } catch (err) {
    next(err);
  }
};

const deleteRecurringCharge = async (req, res, next) => {
  try {
    const charge = await RecurringCharge.findById(req.params.chargeId);
    if (!charge) return res.status(404).json({ success: false, message: 'Recurring charge not found' });

    if (req.user.role === 'owner' && String(charge.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await charge.deleteOne();
    res.json({ success: true, message: 'Recurring charge deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBills,
  getBillDetail,
  createBill,
  addBillItem,
  updateBillItem,
  removeBillItem,
  waiveBillItem,
  publishBill,
  deleteBill,
  getRecurringCharges,
  createRecurringCharge,
  updateRecurringCharge,
  deleteRecurringCharge,
  syncRentRecordToBill,
};
