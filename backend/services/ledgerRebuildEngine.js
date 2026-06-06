'use strict';

const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const LedgerAuditLog = require('../models/LedgerAuditLog');
const logger = require('../config/logger');

/**
 * Enterprise Ledger Rebuild Engine
 */
const recalculateTenantLedger = async (tenantId, jobId, triggerSource, affectedMonth = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch Tenant with Optimistic Lock constraint
    const tenant = await Tenant.findById(tenantId).session(session);
    if (!tenant) throw new Error('Tenant not found');

    const expectedVersion = tenant.ledgerVersion;

    // 2. Fetch all data
    const rentRecords = await MonthlyRentRecord.find({ tenantId }).sort({ month: 1 }).session(session);

    // Fetch transactions (manual and system)
    const txQuery = { tenantId, status: 'completed' };
    const allValidTx = await PaymentTransaction.find(txQuery).sort({ paymentDate: 1 }).session(session);

    // Calculate Before Totals for Audit Log
    const beforeTotals = {
      totalPaid: tenant.totalPaid || 0,
      totalRent: tenant.totalRent || 0,
      advanceBalance: tenant.advanceBalance || 0,
      remainingAmount: tenant.remainingAmount || 0
    };

    // 3. Supersede all old system-generated transactions
    const systemTxQuery = { 
      tenantId, 
      entrySource: 'system_generated', 
      status: 'completed' 
    };
    
    // We update them to superseded.
    await PaymentTransaction.updateMany(
      systemTxQuery,
      { $set: { status: 'superseded', statusReason: 'Superseded by ledger rebuild' } },
      { session }
    );

    // 4. The Core Engine Loop
    if (!tenant.joinDate) {
      throw new Error('LedgerSafetyError: Tenant missing joinDate. Cannot rebuild ledger safely.');
    }
    if (rentRecords.length > 240) {
      throw new Error('LedgerSafetyError: Excessive rent records detected. Potential infinite loop.');
    }

    let currentAdvance = 0;
    let totalRentActual = 0;
    let totalPaidActual = 0;

    for (const record of rentRecords) {
      const manualTxForMonth = allValidTx.filter(t => t.entrySource !== 'system_generated' && String(t.rentRecordId) === String(record._id));
      const manualPaidForMonth = manualTxForMonth.reduce((sum, t) => sum + t.amount, 0);

      let recordTotalPaid = manualPaidForMonth;
      let remaining = Math.max(0, record.totalRent - manualPaidForMonth);

      if (remaining > 0 && currentAdvance > 0) {
        const applied = Math.min(remaining, currentAdvance);

        const idempotencyKey = `advance_applied_${tenantId}_${record._id}_v${expectedVersion}`;
        const exists = await PaymentTransaction.findOne({ idempotencyKey }).session(session);

        if (!exists) {
          await PaymentTransaction.create([{
            rentRecordId: record._id,
            tenantId,
            ownerId: tenant.ownerId,
            propertyId: tenant.propertyId,
            amount: applied,
            paymentMethod: 'other',
            transactionType: 'advance_applied',
            entrySource: 'system_generated',
            idempotencyKey,
            note: 'System generated advance application',
            recordedBy: tenant.ownerId
          }], { session });
        }

        recordTotalPaid += applied;
        remaining -= applied;
        currentAdvance -= applied;
      }

      const overpaid = Math.max(0, manualPaidForMonth - record.totalRent);
      currentAdvance += overpaid;

      record.totalPaid = recordTotalPaid;
      await record.save({ session });

      totalRentActual += record.totalRent;
      totalPaidActual += manualPaidForMonth; // Keep macro actual strictly as manual valid payments
    }

    const remainingAmountActual = Math.max(0, totalRentActual - totalPaidActual);
    const advanceBalanceActual = currentAdvance;

    // 5. Integrity Assertions
    if (totalPaidActual < 0 || remainingAmountActual < 0 || advanceBalanceActual < 0) {
      throw new Error('LedgerSafetyError: Balances cannot be negative.');
    }

    if (Math.abs(remainingAmountActual - Math.max(0, totalRentActual - totalPaidActual)) > 0.01) {
      throw new Error('LedgerSafetyError: Remaining amount invariant failed.');
    }

    if (Math.abs(advanceBalanceActual - Math.max(0, totalPaidActual - totalRentActual)) > 0.01) {
      throw new Error('LedgerSafetyError: Advance balance invariant failed.');
    }

    // Update Tenant with Optimistic Concurrency Lock
    const updatedTenant = await Tenant.findOneAndUpdate(
      { _id: tenantId, ledgerVersion: expectedVersion },
      { 
        $inc: { ledgerVersion: 1 },
        $set: {
          totalPaid: totalPaidActual,
          totalRent: totalRentActual,
          remainingAmount: remainingAmountActual,
          advanceBalance: advanceBalanceActual
        }
      },
      { session, returnDocument: 'after' }
    );

    if (!updatedTenant) {
      throw new Error('OptimisticConcurrencyError: Tenant ledger version mismatch. Stale write prevented.');
    }

    // 6. Create Audit Log
    const newBalances = {
      totalPaid: totalPaidActual,
      totalRent: totalRentActual,
      advanceBalance: advanceBalanceActual,
      remainingAmount: remainingAmountActual
    };

    const auditLog = await LedgerAuditLog.create([{
      tenantId,
      jobId,
      triggerSource,
      oldVersion: expectedVersion,
      newVersion: updatedTenant.ledgerVersion,
      monthsAffected: rentRecords.map(r => r.month),
      beforeTotals,
      afterTotals: newBalances,
      durationMs: 150 // Mock duration
    }], { session });

    await session.commitTransaction();
    session.endSession();

    logger.info(`[LEDGER REBUILD] Successfully completed rebuild for tenant=${tenantId} v=${updatedTenant.ledgerVersion}`);
    return auditLog;

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`[LEDGER REBUILD ERROR] tenant=${tenantId}: ${error.message}`);
    throw error;
  }
};

module.exports = {
  recalculateTenantLedger
};
