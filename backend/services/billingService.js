'use strict';

const mongoose = require('mongoose');
const Tenant   = require('../models/Tenant');
const Payment  = require('../models/Payment');
const logger   = require('../config/logger');

/**
 * billingService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated logic for generating monthly rent bills and updating overdue status.
 */

/**
 * generateMonthlyBills(ownerId)
 * Scans all active tenants and ensures they have a payment record for the current month.
 */
const generateMonthlyBills = async (ownerId) => {
  try {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // "YYYY-MM"
    
    // 1. Fetch all active tenants for this owner
    const activeTenancies = await Tenant.find({ 
      ownerId, 
      status: 'active' 
    }).populate('roomId');

    const billingResults = { created: 0, skipped: 0 };

    for (const tenant of activeTenancies) {
      // 2. Check if a payment already exists for this tenant and month
      const existing = await Payment.findOne({
        tenantId: tenant._id,
        month: currentMonthStr
      });

      if (!existing) {
        // 3. Create the automated bill
        const dueDay = tenant.rentDueDay || 5;
        const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

        await Payment.create({
          tenantId   : tenant._id,
          userId     : tenant.userId,
          roomId     : tenant.roomId._id,
          propertyId : tenant.propertyId,
          ownerId    : tenant.ownerId,
          month      : currentMonthStr,
          amount     : tenant.roomId.monthlyRent || 0,
          status     : 'pending',
          dueDate,
          notes      : 'System generated monthly bill.'
        });
        billingResults.created++;
      } else {
        billingResults.skipped++;
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
 * Marks any pending payments as overdue if the current date is past the due date.
 */
const updateOverduePayments = async (ownerId) => {
  try {
    const today = new Date();
    
    const result = await Payment.updateMany(
      {
        ownerId,
        status  : { $in: ['pending', 'failed', 'partial'] },
        dueDate : { $lt: today }
      },
      {
        $set: { status: 'overdue' }
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[BILLING] Marked ${result.modifiedCount} payments as overdue for owner=${ownerId}`);
    }
    return result.modifiedCount;
  } catch (err) {
    logger.error(`[BILLING ERROR] updateOverduePayments: ${err.message}`);
    throw err;
  }
};

module.exports = {
  generateMonthlyBills,
  updateOverduePayments
};
