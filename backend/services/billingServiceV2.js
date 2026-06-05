'use strict';

/**
 * billingServiceV2.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated billing for the new ledger-based payment system
 */

const Tenant = require('../models/Tenant');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const MigrationHistory = require('../models/MigrationHistory');
const paymentServiceV2 = require('./paymentServiceV2');
const cloudinary = require('../config/cloudinaryConfig');
const logger = require('../config/logger');
const emailService = require('./emailService');

/**
 * generateMonthlyBills(ownerId)
 * Performs automated calendar-month billing orchestration for all active/vacated stays.
 * Idempotently generates bills from join month to current month.
 */
const generateMonthlyBills = async (ownerId) => {
  try {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // "YYYY-MM"
    const billingResults = { created: 0, skipped: 0, errors: 0 };

    // Query stays that are active or vacated
    const activeQuery = {
      $or: [
        { status: 'active' },
        { status: 'vacated' }
      ]
    };
    if (ownerId) activeQuery.ownerId = ownerId;

    const tenancies = await Tenant.find(activeQuery)
      .populate('roomId')
      .populate('userId')
      .populate('ownerId')
      .populate('propertyId');

    for (const tenant of tenancies) {
      try {
        const tenantMonthlyRent = tenant.roomId?.monthlyRent || 0;
        
        // Billing start: get month of moveInDate or joinDate
        const joinDate = new Date(tenant.moveInDate || tenant.joinDate || Date.now());
        const startYear = joinDate.getFullYear();
        const startMonthIndex = joinDate.getMonth(); // 0-11

        // Post-Paid Billing Rule: Only generate bills for COMPLETED months.
        // Therefore, the generation boundary stops at the previous month.
        let endYear = today.getFullYear();
        let endMonthIndex = today.getMonth() - 1;
        if (endMonthIndex < 0) {
          endMonthIndex = 11;
          endYear -= 1;
        }

        // Move-Out Settlement Exception:
        // If the tenant has officially vacated, generate their final settlement bill
        // immediately for the month they exited, even if it is the current month.
        if (tenant.status === 'vacated' && tenant.exitDate) {
          const exitDate = new Date(tenant.exitDate);
          const exitYear = exitDate.getFullYear();
          const exitMonth = exitDate.getMonth();
          
          if (exitYear > endYear || (exitYear === endYear && exitMonth > endMonthIndex)) {
            endYear = exitYear;
            endMonthIndex = exitMonth;
          }
        }

        // Loop from start month to end month
        let iterYear = startYear;
        let iterMonth = startMonthIndex;

        while (true) {
          // Check if we have exceeded the end month
          if (iterYear > endYear || (iterYear === endYear && iterMonth > endMonthIndex)) {
            break;
          }

          const iterMonthStr = `${iterYear}-${String(iterMonth + 1).padStart(2, '0')}`;

          // We no longer gate by cycleDueDate. The loop naturally stops at the current month (`endMonthIndex`),
          // allowing bills to be generated as soon as the month begins, completely independently of their due dates.

          // Check if MonthlyRentRecord already exists
          const existing = await MonthlyRentRecord.findOne({ tenantId: tenant._id, month: iterMonthStr });
          
          if (existing) {
            // Already generated, skip
            logger.info(`[BILLING SKIPPED] reason=duplicate tenant=${tenant._id} month=${iterMonthStr}`);
            billingResults.skipped++;
            
            // Phase D & E: Re-ensure to trigger any recalculations (like move-out settlement) 
            // if the tenant data changed after the bill was initially generated.
            await paymentServiceV2.ensureMonthlyRentRecord(
              tenant._id,
              iterMonthStr,
              tenantMonthlyRent,
              { allowVacated: true }
            );
          } else {
            // Generate using payment service
            const newRecord = await paymentServiceV2.ensureMonthlyRentRecord(
              tenant._id,
              iterMonthStr,
              tenantMonthlyRent,
              {
                notes: `System generated calendar monthly billing for ${iterMonthStr}`,
                allowVacated: true
              }
            );
            
            if (newRecord.isProrated) {
              logger.info(`[BILL GENERATED] tenant=${tenant._id} month=${iterMonthStr} amount=${newRecord.totalRent} prorated=true days=${newRecord.proratedDays}`);
            } else {
              logger.info(`[BILL GENERATED] tenant=${tenant._id} month=${iterMonthStr} amount=${newRecord.totalRent} prorated=false`);
            }
            
            billingResults.created++;

            // Email Triggers
            // Do not spam historical backfills
            if (!tenant.isMigratedTenant || tenant.migrationBackfillCompleted) {
              const isFinalMonth = tenant.status === 'vacated' && tenant.exitDate && new Date(tenant.exitDate).toISOString().slice(0, 7) === iterMonthStr;
              
              if (isFinalMonth) {
                if (tenant.userId) await emailService.sendFinalSettlementEmail(tenant.userId, newRecord, tenant.propertyId, tenant.roomId, tenant.userId).catch(()=>null);
                if (tenant.ownerId) await emailService.sendFinalSettlementEmail(tenant.ownerId, newRecord, tenant.propertyId, tenant.roomId, tenant.userId).catch(()=>null);
              } else {
                if (tenant.userId) await emailService.sendBillGeneratedEmail(tenant.userId, newRecord, tenant.propertyId, tenant.roomId, tenant.userId).catch(()=>null);
                if (tenant.ownerId) await emailService.sendBillGeneratedEmail(tenant.ownerId, newRecord, tenant.propertyId, tenant.roomId, tenant.userId).catch(()=>null);
              }
            }
          }

          // Increment month
          iterMonth++;
          if (iterMonth > 11) {
            iterMonth = 0;
            iterYear++;
          }
        }

        // Mark backfill completed if it was a migrated tenant
        if (tenant.isMigratedTenant && !tenant.migrationBackfillCompleted) {
          tenant.migrationBackfillCompleted = true;
          await tenant.save();
        }

      } catch (tenantErr) {
        logger.error(`[BILLING ERROR] Failed for tenant ${tenant._id}: ${tenantErr.message}`);
        billingResults.errors++;
      }
    }

    if (billingResults.created > 0) {
      logger.info(`[BILLING] Generated ${billingResults.created} bills${ownerId ? ` for owner=${ownerId}` : ' globally'}`);
    }

    return billingResults;
  } catch (err) {
    logger.error(`[BILLING ERROR] generateMonthlyBills: ${err.message}`);
    emailService.sendSystemFailureAlert('generateMonthlyBills Failed', err.stack).catch(() => null);
    throw err;
  }
};

/**
 * processBillingRemindersAndOverdue(ownerId?)
 * Marks records as overdue and strictly implements the 1, 7, 15, 30 day overdue cadence,
 * alongside Due Today reminders.
 */
const updateOverduePayments = async (ownerId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {
      status: { $in: ['pending', 'partial', 'overdue'] },
    };
    if (ownerId) query.ownerId = ownerId;

    const records = await MonthlyRentRecord.find(query)
      .populate('userId')
      .populate('propertyId')
      .populate('roomId');

    let overdueMarked = 0;

    for (const record of records) {
      if (!record.dueDate) continue;

      const dueDate = new Date(record.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = today - dueDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Mark as overdue if past due date
      if (diffDays > 0 && (record.status === 'pending' || record.status === 'partial')) {
        record.status = 'overdue';
        await record.save();
        overdueMarked++;
      }

      // Check if we already sent a reminder today
      if (record.reminderSentAt) {
        const lastSent = new Date(record.reminderSentAt);
        lastSent.setHours(0, 0, 0, 0);
        if (lastSent.getTime() === today.getTime()) continue;
      }

      // Check Cadence rules
      let shouldSend = false;
      let emailType = '';

      if (diffDays === 0) {
        shouldSend = true;
        emailType = 'due_today';
      } else if (diffDays === 1 || diffDays === 7 || diffDays === 15 || diffDays === 30) {
        shouldSend = true;
        emailType = 'overdue';
      }

      if (shouldSend) {
        if (emailType === 'due_today' && record.userId) {
          await emailService.sendDueTodayReminderEmail(record.userId, record, record.propertyId, record.roomId).catch(() => null);
        } else if (emailType === 'overdue' && record.userId) {
          await emailService.sendOverdueAlert(record.userId, record, record.propertyId, record.roomId, null).catch(() => null);
        }
        
        record.reminderSent = true;
        record.reminderSentAt = new Date();
        await record.save();
      }
    }

    if (overdueMarked > 0) {
      logger.info(`[BILLING] Marked ${overdueMarked} records as overdue${ownerId ? ` for owner=${ownerId}` : ' globally'}`);
    }

    return overdueMarked;
  } catch (err) {
    logger.error(`[BILLING ERROR] updateOverduePayments: ${err.message}`);
    emailService.sendSystemFailureAlert('updateOverduePayments Failed', err.stack).catch(() => null);
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
          totalPending: {
            $sum: {
              $cond: [
                { $in: ['$status', ['pending', 'partial']] },
                '$remainingAmount',
                0
              ]
            }
          },
          totalOverdue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'overdue'] },
                '$remainingAmount',
                0
              ]
            }
          },
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
      totalPending: 0,
      totalOverdue: 0,
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

/**
 * Automatically scrub sensitive PII (idProof) from Cloudinary and MongoDB
 * for tenants who vacated more than X days ago.
 */
const purgePrivacyData = async () => {
  const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '30', 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const tenantsToPurge = await Tenant.find({
      status: 'vacated',
      exitDate: { $lte: cutoffDate },
      privacyDataPurged: false,
      idProof: { $ne: '' } // only those that still have a string
    });

    for (const tenant of tenantsToPurge) {
      try {
        let publicId = tenant.idProof;
        if (tenant.idProof.includes('res.cloudinary.com')) {
          const matches = tenant.idProof.match(/\/v\d+\/(.+)\.[a-z]+$/i);
          if (matches && matches[1]) {
            publicId = matches[1];
          }
        }
        
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          logger.info(`[PRIVACY PURGE] Deleted Cloudinary file ${publicId} for tenant ${tenant._id}`);
        }

        tenant.idProof = '';
        tenant.privacyDataPurged = true;
        await tenant.save();

        logger.info(`[PRIVACY PURGE] Scrubbed PII for vacated tenant ${tenant._id}`);
      } catch (err) {
        logger.error(`[PRIVACY PURGE] Failed to purge data for tenant ${tenant._id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`[PRIVACY PURGE] Job failed: ${err.message}`);
  }
};

/**
 * migrateExistingTenants()
 * Safely runs a startup database backfill exactly once system-wide using MigrationHistory tracker.
 */
const migrateExistingTenants = async () => {
  const MIGRATION_ID = 'v2_billing_lifecycle_migration';
  try {
    const alreadyMigrated = await MigrationHistory.findOne({ migrationId: MIGRATION_ID });
    if (alreadyMigrated) {
      logger.info(`[MIGRATION] Migration '${MIGRATION_ID}' already completed. Skipping.`);
      return;
    }

    const legacyTenants = await Tenant.find({ moveInDate: { $exists: false } });
    if (legacyTenants.length > 0) {
      logger.info(`[MIGRATION] Found ${legacyTenants.length} legacy stays to migrate to new billing fields...`);
      for (const tenant of legacyTenants) {
        await tenant.save();
        logger.info(`[MIGRATION] Successfully updated stayId=${tenant._id} with new lifecycle parameters.`);
      }
      logger.info(`[MIGRATION] All legacy stays updated successfully.`);
    }

    await MigrationHistory.create({ migrationId: MIGRATION_ID });
    logger.info(`[MIGRATION] Recorded completion of migration '${MIGRATION_ID}' successfully.`);
  } catch (err) {
    logger.error(`[MIGRATION ERROR] Failed to run legacy tenant stay migration: ${err.message}`);
  }
};

module.exports = {
  generateMonthlyBills,
  updateOverduePayments,
  getSummaryMetrics,
  purgePrivacyData,
  migrateExistingTenants
};
