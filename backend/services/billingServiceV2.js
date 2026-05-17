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

/**
 * getDueDateForMonth(year, monthIndex, billingDay)
 * Returns the correct date on the billingDay of the target month index.
 * Safely caps the day for shorter months (e.g. Feb 28/29, April 30) when day is 31.
 */
const getDueDateForMonth = (year, monthIndex, billingDay) => {
  const tempDate = new Date(year, monthIndex, billingDay);
  if (tempDate.getMonth() !== monthIndex) {
    return new Date(year, monthIndex + 1, 0); // Last day of target month
  }
  return tempDate;
};

/**
 * generateMonthlyBills(ownerId)
 * Performs automated billing orchestration for all active stays.
 * bifurcated into Mode B (Historical Backfill) and Mode A (Future Billing).
 */
const generateMonthlyBills = async (ownerId) => {
  try {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // "YYYY-MM"
    const billingResults = { created: 0, skipped: 0, errors: 0 };

    // ─────────────────────────────────────────────────────────────────────────
    // MODE B — Historical Backfill Generator for Migrated Tenants
    // Runs for active stays where isMigratedTenant = true and migrationBackfillCompleted = false
    // ─────────────────────────────────────────────────────────────────────────
    const migratedQuery = {
      status: 'active',
      isMigratedTenant: true,
      migrationBackfillCompleted: false
    };
    if (ownerId) migratedQuery.ownerId = ownerId;

    const migratedTenancies = await Tenant.find(migratedQuery).populate('roomId', 'monthlyRent');

    for (const tenant of migratedTenancies) {
      try {
        if (!tenant.firstBillingDate) {
          logger.warn(`[BILLING BACKFILL] Skip stayId=${tenant._id}: firstBillingDate is missing`);
          continue;
        }

        const startBillingDate = new Date(tenant.firstBillingDate);
        let year = startBillingDate.getFullYear();
        let month = startBillingDate.getMonth(); // 0-11
        const tenantMonthlyRent = tenant.roomId?.monthlyRent || 0;

        let backfillSuccess = true;

        while (true) {
          const iterMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
          
          if (iterMonthStr > currentMonthStr) {
            break; // We have backfilled up to the current date's month
          }

          // Compute the due date for this historical cycle
          const cycleDueDate = getDueDateForMonth(year, month, tenant.billingDay || 5);

          // Billing Freeze Check: if exitDate is set and exitDate <= cycleDueDate, freeze all future generation
          if (tenant.exitDate && new Date(tenant.exitDate) <= cycleDueDate) {
            logger.info(`[BILLING FREEZE] Skip historical month=${iterMonthStr} for stayId=${tenant._id} (exitDate=${tenant.exitDate.toISOString().slice(0, 10)} <= cycleDueDate=${cycleDueDate.toISOString().slice(0, 10)})`);
            break;
          }

          // Check if MonthlyRentRecord already exists
          const existing = await MonthlyRentRecord.findOne({ tenantId: tenant._id, month: iterMonthStr });
          if (existing) {
            logger.info(`[BILLING SKIPPED] reason=duplicate_existing_record stayId=${tenant._id} billingMonth=${iterMonthStr}`);
          } else {
            try {
              await paymentServiceV2.ensureMonthlyRentRecord(
                tenant._id,
                iterMonthStr,
                tenantMonthlyRent,
                {
                  notes: 'System generated historical billing backfill',
                }
              );
              logger.info(`[BILLING BACKFILL] Created historical bill for stayId=${tenant._id} month=${iterMonthStr}`);
              billingResults.created++;
            } catch (createErr) {
              logger.error(`[BILLING BACKFILL ERROR] Failed to create historical bill for stayId=${tenant._id} month=${iterMonthStr}: ${createErr.message}`);
              backfillSuccess = false;
            }
          }

          // Safely increment month index using integers to avoid day-wrapping bugs
          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
        }

        // Self-Healing Recovery Check: only complete migration if all months were successfully generated
        if (backfillSuccess) {
          tenant.migrationBackfillCompleted = true;
          await tenant.save();
          logger.info(`[BILLING BACKFILL] Completed historical backfill for stayId=${tenant._id}`);
        }

      } catch (err) {
        logger.error(`[BILLING BACKFILL] Failed historical backfill process for stayId=${tenant._id}: ${err.message}`);
        billingResults.errors++;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODE A — Future Billing Generator
    // ─────────────────────────────────────────────────────────────────────────
    const activeQuery = {
      status: 'active',
      $or: [{ exitDate: null }, { exitDate: { $gt: today } }] // Strict billing freeze after vacate
    };
    if (ownerId) activeQuery.ownerId = ownerId;

    const activeTenancies = await Tenant.find(activeQuery).populate('roomId', 'monthlyRent');

    for (const tenant of activeTenancies) {
      try {
        if (!tenant.firstBillingDate) {
          continue;
        }

        const firstBillingMonthStr = tenant.firstBillingDate.toISOString().slice(0, 7);
        if (currentMonthStr < firstBillingMonthStr) {
          logger.info(`[BILLING SKIPPED] reason=before_first_billing_date stayId=${tenant._id} billingMonth=${currentMonthStr}`);
          billingResults.skipped++;
          continue;
        }

        const [year, monthNum] = currentMonthStr.split('-').map(Number);
        const cycleDueDate = getDueDateForMonth(year, monthNum - 1, tenant.billingDay || 5);

        // Billing Freeze Check: if exitDate is set and exitDate <= cycleDueDate, freeze/skip
        if (tenant.exitDate && new Date(tenant.exitDate) <= cycleDueDate) {
          logger.info(`[BILLING FREEZE] Skip month=${currentMonthStr} for stayId=${tenant._id} (exitDate=${tenant.exitDate.toISOString().slice(0, 10)} <= cycleDueDate=${cycleDueDate.toISOString().slice(0, 10)})`);
          continue;
        }

        const monthlyRent = tenant.roomId?.monthlyRent || 0;

        const existing = await MonthlyRentRecord.findOne({ tenantId: tenant._id, month: currentMonthStr });
        if (existing) {
          logger.info(`[BILLING SKIPPED] reason=duplicate_existing_record stayId=${tenant._id} billingMonth=${currentMonthStr}`);
          billingResults.skipped++;
        } else {
          await paymentServiceV2.ensureMonthlyRentRecord(
            tenant._id,
            currentMonthStr,
            monthlyRent,
            {
              notes: 'System generated monthly billing',
            }
          );
          logger.info(`[BILLING] Created bill for stayId=${tenant._id} month=${currentMonthStr}`);
          billingResults.created++;
        }
      } catch (err) {
        logger.error(`[BILLING] Failed to create bill for tenant ${tenant._id}: ${err.message}`);
        billingResults.errors++;
      }
    }

    if (billingResults.created > 0) {
      logger.info(`[BILLING] Generated ${billingResults.created} bills${ownerId ? ` for owner=${ownerId}` : ' globally'}`);
    }

    return billingResults;
  } catch (err) {
    logger.error(`[BILLING ERROR] generateMonthlyBills: ${err.message}`);
    throw err;
  }
};

/**
 * updateOverduePayments(ownerId?)
 * Marks pending/partial records as overdue if current date passed due date
 */
const updateOverduePayments = async (ownerId) => {
  try {
    const today = new Date();
    
    const query = {
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lt: today },
    };
    if (ownerId) query.ownerId = ownerId;

    const result = await MonthlyRentRecord.updateMany(query, {
      $set: { status: 'overdue' }
    });

    if (result.modifiedCount > 0) {
      logger.info(`[BILLING] Marked ${result.modifiedCount} records as overdue${ownerId ? ` for owner=${ownerId}` : ' globally'}`);
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
