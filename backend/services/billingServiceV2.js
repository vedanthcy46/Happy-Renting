'use strict';

/**
 * billingServiceV2.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated billing for the new ledger-based payment system
 */

const Tenant = require('../models/Tenant');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const paymentServiceV2 = require('./paymentServiceV2');
const logger = require('../config/logger');

/**
 * generateMonthlyBills(ownerId)
 * Creates MonthlyRentRecords for all active tenants if not already present
 */
const generateMonthlyBills = async (ownerId) => {
  try {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // "YYYY-MM"

    // 1. Get all active tenants for this owner
    const activeTenancies = await Tenant.find({
      ownerId,
      status: 'active'
    }).populate('roomId', 'monthlyRent');

    const billingResults = { created: 0, skipped: 0, errors: 0 };

    for (const tenant of activeTenancies) {
      try {
        const monthlyRent = tenant.roomId?.monthlyRent || 0;

        await paymentServiceV2.ensureMonthlyRentRecord(
          tenant._id,
          currentMonthStr,
          monthlyRent,
          {
            notes: 'System generated monthly billing',
          }
        );

        billingResults.created++;
      } catch (err) {
        logger.error(`[BILLING] Failed to create bill for tenant ${tenant._id}: ${err.message}`);
        billingResults.errors++;
      }
    }

    if (billingResults.created > 0) {
      logger.info(`[BILLING] Generated ${billingResults.created} bills for owner=${ownerId}`);
    }

    return billingResults;
  } catch (err) {
    logger.error(`[BILLING ERROR] generateMonthlyBills: ${err.message}`);
    throw err;
  }
};

/**
 * updateOverduePayments(ownerId)
 * Marks pending/partial records as overdue if current date passed due date
 */
const updateOverduePayments = async (ownerId) => {
  try {
    const today = new Date();

    const result = await MonthlyRentRecord.updateMany(
      {
        ownerId,
        status: { $in: ['pending', 'partial'] },
        dueDate: { $lt: today },
      },
      {
        $set: { status: 'overdue' }
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[BILLING] Marked ${result.modifiedCount} records as overdue for owner=${ownerId}`);
    }

    return result.modifiedCount;
  } catch (err) {
    logger.error(`[BILLING ERROR] updateOverduePayments: ${err.message}`);
    throw err;
  }
};

/**
 * getSummaryMetrics(ownerId, filters?)
 * Returns aggregated payment metrics for owner
 */
const getSummaryMetrics = async (ownerId, filters = {}) => {
  try {
    const query = { ownerId };

    if (filters.propertyId) {
      query.propertyId = filters.propertyId;
    }

    const metrics = await MonthlyRentRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$totalRent' },
          totalCollected: { $sum: '$totalPaid' },
          totalOutstanding: { $sum: '$remainingAmount' },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          partialCount: {
            $sum: { $cond: [{ $eq: ['$status', 'partial'] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          },
        }
      }
    ]);

    return metrics.length > 0 ? metrics[0] : {
      totalDue: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      paidCount: 0,
      partialCount: 0,
      pendingCount: 0,
      overdueCount: 0,
    };
  } catch (err) {
    logger.error(`[BILLING ERROR] getSummaryMetrics: ${err.message}`);
    throw err;
  }
};

module.exports = {
  generateMonthlyBills,
  updateOverduePayments,
  getSummaryMetrics,
};
