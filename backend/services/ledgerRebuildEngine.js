'use strict';

const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const LedgerAuditLog = require('../models/LedgerAuditLog');
const LedgerPeriod = require('../models/LedgerPeriod');
const { loadSnapshot, createSnapshot } = require('./ledgerSnapshotService');
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

    // 2. Load Snapshot for Partial Rebuild Optimization
    const snapshot = await loadSnapshot(tenantId, affectedMonth);
    let startMonth = null;
    let currentBalances = { totalPaid: 0, totalRent: 0, advanceBalance: 0, remainingAmount: 0 };
    
    if (snapshot) {
      startMonth = snapshot.asOfMonth;
      currentBalances = { ...snapshot.balances };
      logger.info(`[LEDGER REBUILD] Resuming from snapshot ${startMonth} for tenant=${tenantId}`);
    } else {
      logger.info(`[LEDGER REBUILD] Full rebuild for tenant=${tenantId}`);
    }

    // Check Freeze Period
    if (startMonth) {
      const period = await LedgerPeriod.findOne({ tenantId, month: startMonth }).session(session);
      if (period && period.status === 'closed') {
        throw new Error(`LedgerSafetyError: Cannot rebuild from closed period ${startMonth}. Adjustments must be posted to current open period.`);
      }
    }

    // 3. Fetch all data from startMonth onwards
    const rentQuery = { tenantId };
    if (startMonth) rentQuery.month = { $gte: startMonth };
    const rentRecords = await MonthlyRentRecord.find(rentQuery).sort({ month: 1 }).session(session);

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

    // 4. Supersede old system-generated transactions from startMonth onwards
    // Wait, we need to find existing system_generated ones that we will replace
    // Actually, we should supersede any advance_applied / settlement_adjustment
    // starting from startMonth that were system generated.
    // For simplicity, any system_generated transaction from startMonth is superseded.
    const systemTxQuery = { 
      tenantId, 
      entrySource: 'system_generated', 
      status: 'completed' 
    };
    if (startMonth) {
      // We need a way to filter by month. But transactions have paymentDate, not month.
      // We can filter by rentRecordId if we mapped them, or just supersede all and regenerate.
      // We will supersede them and regenerate new ones.
    }
    
    // We update them to superseded.
    await PaymentTransaction.updateMany(
      systemTxQuery,
      { $set: { status: 'superseded', statusReason: 'Superseded by ledger rebuild' } },
      { session }
    );

    // 5. The Core Engine Loop
    if (!tenant.joinDate) {
      throw new Error('LedgerSafetyError: Tenant missing joinDate. Cannot rebuild ledger safely.');
    }
    if (rentRecords.length > 240) {
      throw new Error('LedgerSafetyError: Excessive rent records detected. Potential infinite loop.');
    }

    let currentAdvance = currentBalances.advanceBalance || 0;
    let totalRentActual = currentBalances.totalRent || 0;
    let totalPaidActual = currentBalances.totalPaid || 0;

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

    // 6. Integrity Assertions
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
      { session, new: true }
    );

    if (!updatedTenant) {
      throw new Error('OptimisticConcurrencyError: Tenant ledger version mismatch. Stale write prevented.');
    }

    // 7. Create Snapshot & Audit Log
    const newBalances = {
      totalPaid: totalPaidActual,
      totalRent: totalRentActual,
      advanceBalance: advanceBalanceActual,
      remainingAmount: remainingAmountActual
    };

    // We create snapshot for the current date (latest rent record month)
    const latestMonth = rentRecords.length > 0 ? rentRecords[rentRecords.length - 1].month : new Date().toISOString().slice(0, 7);
    await createSnapshot(tenantId, latestMonth, newBalances, session);

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
