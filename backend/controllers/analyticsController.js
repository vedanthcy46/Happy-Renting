'use strict';

/**
 * analyticsController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium owner analytics: multi-month rent collection, income trend,
 * paid-vs-pending and occupancy. All series are derived from existing
 * MonthlyRentRecord / PaymentTransaction / Room data and gated by the
 * owner's plan reportMonths window (FREE = current month only).
 */

const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const Room = require('../models/Room');
const Property = require('../models/Property');
const entitlementService = require('../services/entitlementService');
const { getPlan, isUnlimited } = require('../config/plans');

// Internal reclassifications, not new cash received (mirrors expenseController)
const NON_CASH_TRANSACTION_TYPES = ['advance_applied', 'advance_deducted'];

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const shiftMonthKey = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthRange = (key) => {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { start, end };
};

/**
 * GET /api/v2/analytics/owner
 * Returns the series backing the premium analytics charts.
 *
 *   months:              how many trailing months to include (gated by plan)
 *   collectionTrend:     [{ month, expected, collected, pending }]
 *   incomeTrend:         [{ month, income }]  (actual cash collected)
 *   paidVsPending:       { paid, pending }     (within the returned window)
 *   occupancy:           { totalRooms, occupiedRooms, vacantRooms, occupancyRate }
 *   tenantPaymentStatus: { paid, partial, pending, overdue } (current month record counts)
 *   paymentMethods:      [{ method, amount, count }] (window, completed cash)
 *   propertyCollection:  [{ propertyId, name, expected, collected, pending }] (current month)
 *   propertyOccupancy:   [{ propertyId, name, totalRooms, occupiedRooms, occupancyRate }]
 */
exports.getOwnerAnalytics = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const plan = getPlan(entitlementService.planKeyForOwner(req.user));

    // FREE → 1 month; premium → last 6 months (fair use cap).
    let months = isUnlimited(plan.reportMonths) || plan.reportMonths >= 999 ? 6 : Math.min(6, plan.reportMonths);
    months = Math.max(1, months);

    const nowKey = currentMonthKey();
    const keys = [];
    for (let i = 0; i < months; i++) {
      keys.push(shiftMonthKey(nowKey, -i));
    }

    const ownerObjId = new mongoose.Types.ObjectId(ownerId);

    // ── Monthly rent collection (expected / collected / pending) ──
    const recordAgg = await MonthlyRentRecord.aggregate([
      { $match: { ownerId: ownerObjId, month: { $in: keys } } },
      {
        $group: {
          _id: '$month',
          expected: { $sum: '$totalRent' },
          collected: { $sum: '$totalPaid' },
          pending: { $sum: '$remainingAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const recordMap = new Map(recordAgg.map((r) => [r._id, r]));
    const collectionTrend = [...keys].reverse().map((key) => {
      const row = recordMap.get(key) || { expected: 0, collected: 0, pending: 0 };
      return { month: key, expected: row.expected, collected: row.collected, pending: row.pending };
    });

    // ── Income trend (actual completed cash) ──
    const monthBounds = keys.map((k) => ({ key: k, ...monthRange(k) }));
    const incomeAgg = await PaymentTransaction.aggregate([
      {
        $match: {
          ownerId: ownerObjId,
          status: 'completed',
          amount: { $gt: 0 },
          transactionType: { $nin: NON_CASH_TRANSACTION_TYPES },
          paymentDate: {
            $gte: monthBounds[monthBounds.length - 1].start,
            $lt: monthBounds[0].end,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          income: { $sum: '$amount' },
        },
      },
    ]);

    const incomeMap = new Map();
    for (const row of incomeAgg) {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
      incomeMap.set(key, row.income);
    }
    const incomeTrend = [...keys].reverse().map((key) => ({
      month: key,
      income: incomeMap.get(key) || 0,
    }));

    // ── Paid vs pending within window ──
    const paid = collectionTrend.reduce((s, m) => s + m.collected, 0);
    const pending = collectionTrend.reduce((s, m) => s + m.pending, 0);

    // ── Tenant payment status (current month rent records by status) ──
    const statusAgg = await MonthlyRentRecord.aggregate([
      { $match: { ownerId: ownerObjId, month: nowKey } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusMap = new Map(statusAgg.map((r) => [r._id, r.count]));
    const tenantPaymentStatus = {
      paid: statusMap.get('paid') || 0,
      partial: statusMap.get('partial') || 0,
      pending: statusMap.get('pending') || 0,
      overdue: statusMap.get('overdue') || 0,
    };

    // ── Payment method distribution (window, completed positive cash) ──
    const methodAgg = await PaymentTransaction.aggregate([
      {
        $match: {
          ownerId: ownerObjId,
          status: 'completed',
          amount: { $gt: 0 },
          transactionType: { $nin: NON_CASH_TRANSACTION_TYPES },
          paymentDate: {
            $gte: monthBounds[monthBounds.length - 1].start,
            $lt: monthBounds[0].end,
          },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$paymentMethod', 'other'] },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    const paymentMethods = methodAgg.map((r) => ({
      method: r._id,
      amount: r.amount,
      count: r.count,
    }));

    // ── Occupancy + property-wise series ──
    const properties = await Property.find({ ownerId: ownerObjId }).select('_id name').lean();
    const propertyIds = properties.map((p) => p._id);
    const occupancyAgg = propertyIds.length
      ? await Room.aggregate([
          { $match: { propertyId: { $in: propertyIds }, isActive: true } },
          {
            $group: {
              _id: null,
              totalRooms: { $sum: 1 },
              occupiedRooms: {
                $sum: { $cond: [{ $gt: ['$currentOccupancy', 0] }, 1, 0] },
              },
            },
          },
        ])
      : [];
    const totalRooms = occupancyAgg[0]?.totalRooms || 0;
    const occupiedRooms = Math.min(occupancyAgg[0]?.occupiedRooms || 0, totalRooms);
    const vacantRooms = Math.max(totalRooms - occupiedRooms, 0);
    const occupancyRate = totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

    // ── Property-wise occupancy (current) ──
    const propOccupancyAgg = propertyIds.length
      ? await Room.aggregate([
          { $match: { propertyId: { $in: propertyIds }, isActive: true } },
          {
            $group: {
              _id: '$propertyId',
              totalRooms: { $sum: 1 },
              occupiedRooms: {
                $sum: { $cond: [{ $gt: ['$currentOccupancy', 0] }, 1, 0] },
              },
            },
          },
        ])
      : [];
    const propertyOccupancy = properties.map((p) => {
      const row = propOccupancyAgg.find((r) => String(r._id) === String(p._id));
      const pTotal = row?.totalRooms || 0;
      const pOccupied = Math.min(row?.occupiedRooms || 0, pTotal);
      return {
        propertyId: p._id,
        name: p.name,
        totalRooms: pTotal,
        occupiedRooms: pOccupied,
        occupancyRate: pTotal > 0 ? Number(((pOccupied / pTotal) * 100).toFixed(1)) : 0,
      };
    });

    // ── Property-wise rent collection (current month) ──
    const propCollectionAgg = await MonthlyRentRecord.aggregate([
      { $match: { ownerId: ownerObjId, month: nowKey } },
      {
        $group: {
          _id: '$propertyId',
          expected: { $sum: '$totalRent' },
          collected: { $sum: '$totalPaid' },
          pending: { $sum: '$remainingAmount' },
        },
      },
    ]);
    const propertyCollection = properties
      .map((p) => {
        const row = propCollectionAgg.find((r) => String(r._id) === String(p._id));
        return {
          propertyId: p._id,
          name: p.name,
          expected: row?.expected || 0,
          collected: row?.collected || 0,
          pending: row?.pending || 0,
        };
      })
      .filter((p) => p.expected > 0 || p.collected > 0)
      .sort((a, b) => b.collected - a.collected);

    res.status(200).json({
      success: true,
      months,
      collectionTrend,
      incomeTrend,
      paidVsPending: { paid, pending },
      occupancy: { totalRooms, occupiedRooms, vacantRooms, occupancyRate },
      tenantPaymentStatus,
      paymentMethods,
      propertyCollection,
      propertyOccupancy,
    });
  } catch (err) {
    next(err);
  }
};