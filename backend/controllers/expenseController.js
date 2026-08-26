'use strict';

const { body } = require('express-validator');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Property = require('../models/Property');
const PaymentTransaction = require('../models/PaymentTransaction');
const logActivity = require('../utils/activityLogger');
const entitlementService = require('../services/entitlementService');
const { getPlan, isUnlimited } = require('../config/plans');

// ── Validation chains ──────────────────────────────────────────────────────
const expenseValidation = [
  body('propertyId').isMongoId().withMessage('Valid property ID required'),
  body('category').isIn(Expense.EXPENSE_CATEGORIES).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than zero'),
  body('month').matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('Month must be in YYYY-MM format'),
  body('title').optional().trim().isLength({ max: 100 }).withMessage('Title max 100 chars'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes max 500 chars'),
];

// Excluded transaction types are internal reclassifications, not new cash received
const NON_CASH_TRANSACTION_TYPES = ['advance_applied', 'advance_deducted', 'waiver'];

const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { start, end };
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const shiftMonthKey = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Enforce the plan's reportMonths history window for OWNERS.
 * FREE allows only the current month; premium allows full history.
 * Throws a 403 (via next) when the requested month is outside the window.
 */
const enforceReportMonthWindow = (user, month) => {
  if (!user || user.role !== 'owner') return;
  const plan = getPlan(entitlementService.planKeyForOwner(user));
  if (isUnlimited(plan.reportMonths) || plan.reportMonths >= 999) return;
  const nowKey = currentMonth();
  if (month > nowKey) return; // future months aren't report history — let it return empty
  const oldestAllowed = shiftMonthKey(nowKey, -(plan.reportMonths - 1));
  if (month < oldestAllowed) {
    const err = new Error(
      'Report history is limited to the last ' + plan.reportMonths + ' month' + (plan.reportMonths === 1 ? '' : 's') +
      ' on the free plan. Upgrade to access older reports.'
    );
    err.statusCode = 403;
    throw err;
  }
};

// ── GET /api/v2/expenses?month=YYYY-MM&propertyId=id ─────────────────────
exports.getExpenses = async (req, res, next) => {
  try {
    const filter = { ownerId: req.user._id };
    if (req.query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)) {
      enforceReportMonthWindow(req.user, req.query.month);
      filter.month = req.query.month;
    }
    if (req.query.propertyId && /^[a-f\d]{24}$/i.test(req.query.propertyId)) {
      filter.propertyId = req.query.propertyId;
    }

    const expenses = await Expense.find(filter)
      .populate('propertyId', 'name address')
      .sort({ expenseDate: -1, createdAt: -1 });

    res.status(200).json({ success: true, count: expenses.length, expenses });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v2/expenses/recurring ────────────────────────────────────────
exports.getRecurringExpenses = async (req, res, next) => {
  try {
    const filter = { ownerId: req.user._id, isRecurring: true };
    if (req.query.propertyId && /^[a-f\d]{24}$/i.test(req.query.propertyId)) {
      filter.propertyId = req.query.propertyId;
    }
    const expenses = await Expense.find(filter)
      .populate('propertyId', 'name address')
      .sort({ category: 1, title: 1 });
    res.status(200).json({ success: true, count: expenses.length, expenses });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v2/expenses/summary?month=YYYY-MM&propertyId=id ─────────────
exports.getExpenseSummary = async (req, res, next) => {
  try {
    const month = req.query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)
      ? req.query.month
      : currentMonth();
    enforceReportMonthWindow(req.user, month);
    const { start, end } = monthRange(month);

    const expenseFilter = { ownerId: req.user._id, month };
    const txnFilter = {
      ownerId: req.user._id,
      status: 'completed',
      paymentDate: { $gte: start, $lt: end },
      transactionType: { $nin: NON_CASH_TRANSACTION_TYPES },
    };
    if (req.query.propertyId && /^[a-f\d]{24}$/i.test(req.query.propertyId)) {
      const propertyObjectId = new mongoose.Types.ObjectId(req.query.propertyId);
      expenseFilter.propertyId = propertyObjectId;
      txnFilter.propertyId = propertyObjectId;
    }

    const [expensesAgg, txnAgg, expenseCount] = await Promise.all([
      Expense.aggregate([
        { $match: expenseFilter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.aggregate([
        { $match: txnFilter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.countDocuments(expenseFilter),
    ]);

    const totalExpenses = expensesAgg[0]?.total || 0;
    const totalIncome = txnAgg[0]?.total || 0;
    const netProfit = totalIncome - totalExpenses;

    res.status(200).json({
      success: true,
      summary: {
        month,
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        expenseCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/v2/expenses ─────────────────────────────────────────────────
exports.createExpense = async (req, res, next) => {
  try {
    const { propertyId, category, title, amount, month, isRecurring, notes, expenseDate } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });
    if (String(property.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const expense = await Expense.create({
      ownerId: req.user._id,
      propertyId,
      category,
      title: title || '',
      amount: Number(amount),
      month,
      isRecurring: !!isRecurring,
      notes: notes || '',
      expenseDate: expenseDate || new Date(),
    });

    await logActivity(req.user._id, 'EXPENSE_CREATED', expense._id, 'Expense', `Added expense of ₹${expense.amount}`, req.ip);
    res.status(201).json({ success: true, message: 'Expense added.', expense });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/v2/expenses/:id ────────────────────────────────────────────
exports.updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    if (String(expense.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { propertyId, category, title, amount, month, isRecurring, notes, expenseDate } = req.body;

    if (propertyId) {
      const property = await Property.findById(propertyId);
      if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });
      if (String(property.ownerId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      expense.propertyId = propertyId;
    }
    if (category !== undefined) expense.category = category;
    if (title !== undefined) expense.title = title;
    if (amount !== undefined) expense.amount = Number(amount);
    if (month !== undefined) expense.month = month;
    if (isRecurring !== undefined) expense.isRecurring = !!isRecurring;
    if (notes !== undefined) expense.notes = notes;
    if (expenseDate !== undefined) expense.expenseDate = expenseDate;

    await expense.save();
    await logActivity(req.user._id, 'EXPENSE_UPDATED', expense._id, 'Expense', `Updated expense of ₹${expense.amount}`, req.ip);
    res.status(200).json({ success: true, message: 'Expense updated.', expense });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/v2/expenses/:id ───────────────────────────────────────────
exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
    if (String(expense.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await expense.deleteOne();
    await logActivity(req.user._id, 'EXPENSE_DELETED', expense._id, 'Expense', `Deleted expense of ₹${expense.amount}`, req.ip);
    res.status(200).json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getExpenses: exports.getExpenses,
  getRecurringExpenses: exports.getRecurringExpenses,
  getExpenseSummary: exports.getExpenseSummary,
  createExpense: exports.createExpense,
  updateExpense: exports.updateExpense,
  deleteExpense: exports.deleteExpense,
  expenseValidation,
};
