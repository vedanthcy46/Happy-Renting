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
 * generateMonthlyBills(ownerId, tenantId)
 * Performs automated calendar-month billing orchestration.
 * Idempotently generates bills from join month to current month.
 */
const generateMonthlyBills = async (ownerId, tenantId) => {
  try {
    const utcDate = new Date();
    const istString = utcDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const today = new Date(istString);
    const currentMonthStr = today.toISOString().slice(0, 7); // "YYYY-MM"
    
    logger.info(`[CRON-V2] IST Date: ${today.toISOString()}`);
    const billingResults = { created: 0, skipped: 0, errors: 0 };

    // Query stays that are active or vacated
    const activeQuery = {
      $or: [
        { status: 'active' },
        { status: 'vacated' }
      ]
    };
    if (ownerId) activeQuery.ownerId = ownerId;
    if (tenantId) activeQuery._id = tenantId;

    const tenancies = await Tenant.find(activeQuery)
      .populate('roomId')
      .populate('userId')
      .populate('ownerId')
      .populate('propertyId');

    logger.info(`[CRON-V2] Found ${tenancies.length} eligible tenants`);

    // Bulk pre-fetch existing records to avoid N+1 queries in the loop
    const allRecords = await MonthlyRentRecord.find({
      tenantId: { $in: tenancies.map(t => t._id) }
    }).select('tenantId month status').lean();

    const existingMap = new Map();
    for (const r of allRecords) {
      existingMap.set(`${r.tenantId}_${r.month}`, r.status);
    }

    const ownerSummaryMap = new Map(); // Track billing counts for consolidated owner notification

    for (const tenant of tenancies) {
      try {
        const tenantMonthlyRent = tenant.roomId?.monthlyRent || 0;
        
        // Billing start: get month of moveInDate or joinDate
        const joinDate = new Date(tenant.moveInDate || tenant.joinDate || Date.now());
        const startYear = joinDate.getFullYear();
        const startMonthIndex = joinDate.getMonth(); // 0-11

        // FAILSAFE: Prevent infinite loops if joinDate is completely invalid
        if (isNaN(startYear) || isNaN(startMonthIndex)) {
          logger.warn(`[BILLING SKIPPED] Invalid joinDate for tenant ${tenant._id}`);
          continue;
        }

        let endYear = today.getFullYear();
        let endMonthIndex = today.getMonth() - 1; // Default: Postpaid billing (generate previous month's bill in current month)
        
        // Handle year wrap-around for January
        if (endMonthIndex < 0) {
          endMonthIndex = 11;
          endYear--;
        }

        // Move-Out Settlement Exception:
        // If the tenant has officially vacated, generate their final settlement bill
        // immediately for the month they exited, even if it is the current month.
        if (tenant.status === 'vacated' && tenant.exitDate) {
          const exitDate = new Date(tenant.exitDate);
          const exitYear = exitDate.getFullYear();
          const exitMonth = exitDate.getMonth();
          
          if (!isNaN(exitYear) && !isNaN(exitMonth)) {
            // Force the loop to include the exit month if it's ahead of the default endMonthIndex
            if (exitYear > endYear || (exitYear === endYear && exitMonth > endMonthIndex)) {
              endYear = exitYear;
              endMonthIndex = exitMonth;
            }
          }
        }

        // Loop from start month to end month
        let iterYear = startYear;
        let iterMonth = startMonthIndex;

        // Failsafe iteration counter to absolutely guarantee no infinite loops
        let circuitBreaker = 0;

        while (circuitBreaker < 120) { // Max 10 years backfill per tenant
          circuitBreaker++;

          // Check if we have exceeded the end month
          if (iterYear > endYear || (iterYear === endYear && iterMonth > endMonthIndex)) {
            break;
          }

          const iterMonthStr = `${iterYear}-${String(iterMonth + 1).padStart(2, '0')}`;
          const existingStatus = existingMap.get(`${tenant._id}_${iterMonthStr}`);
          
          if (existingStatus) {
            // Already generated, skip
            billingResults.skipped++;
            
            // OPTIMIZATION: Only recalculate the current month or the final move-out month, not historical months!
            const isFinalMonth = tenant.status === 'vacated' && tenant.exitDate && new Date(tenant.exitDate).toISOString().slice(0, 7) === iterMonthStr;
            const isCurrentMonth = iterMonthStr === currentMonthStr;

            if ((isFinalMonth || isCurrentMonth) && existingStatus !== 'paid') {
              await paymentServiceV2.ensureMonthlyRentRecord(
                tenant._id,
                iterMonthStr,
                tenantMonthlyRent,
                { allowVacated: true }
              );
            }
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
            
            billingResults.created++;
            logger.info(`[CRON-V2] Created rent record for tenant ${tenant._id}`);

            // Email Triggers
            // Do not spam historical backfills
            if (!tenant.isMigratedTenant || tenant.migrationBackfillCompleted) {
              const isFinalMonth = tenant.status === 'vacated' && tenant.exitDate && new Date(tenant.exitDate).toISOString().slice(0, 7) === iterMonthStr;
              
              if (isFinalMonth) {
                if (tenant.userId) await emailService.sendFinalSettlementEmail({ user: tenant.userId, role: 'tenant', rentRecord: newRecord, property: tenant.propertyId, room: tenant.roomId, tenantUser: tenant.userId }).catch(()=>null);
              } else {
                if (tenant.userId) await emailService.sendBillGeneratedEmail({ user: tenant.userId, role: 'tenant', rentRecord: newRecord, property: tenant.propertyId, room: tenant.roomId, tenantUser: tenant.userId }).catch(()=>null);
              }

              if (tenant.ownerId) {
                const ownerIdKey = String(tenant.ownerId._id || tenant.ownerId);
                const currentData = ownerSummaryMap.get(ownerIdKey) || { owner: tenant.ownerId, count: 0 };
                currentData.count++;
                ownerSummaryMap.set(ownerIdKey, currentData);
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

        // IMPORTANT: Auto-apply any advance balances to newly generated bills!
        try {
          await paymentServiceV2.applyAdvanceBalance(tenant._id);
        } catch (advanceErr) {
          logger.error(`[BILLING ERROR] Failed to apply advance balance for tenant ${tenant._id}: ${advanceErr.message}`);
        }

      } catch (tenantErr) {
        logger.error(`[BILLING ERROR] Failed for tenant ${tenant._id}: ${tenantErr.message}`);
        logger.error(`[CRON-V2] Failed for tenant ${tenant._id}`, tenantErr);
        billingResults.errors++;
      }
    }

    // Send consolidated owner summary emails
    const targetMonthIndex = today.getMonth() - 1;
    const targetYear = targetMonthIndex < 0 ? today.getFullYear() - 1 : today.getFullYear();
    const normMonth = targetMonthIndex < 0 ? 11 : targetMonthIndex;
    const targetMonthLabel = `${targetYear}-${String(normMonth + 1).padStart(2, '0')}`;

    for (const [ownerId, data] of ownerSummaryMap.entries()) {
      if (data.count > 0) {
        await emailService.sendOwnerBillingSummaryEmail(data.owner, data.count, targetMonthLabel).catch((err) => {
          logger.error(`[BILLING SUMMARY ERROR] Failed to send email to owner ${ownerId}: ${err.message}`);
        });
      }
    }

    if (billingResults.created > 0) {
      logger.info(`[CRON-V2] Generated ${billingResults.created} monthly rent records`);
      logger.info(`[BILLING] Generated ${billingResults.created} bills${ownerId ? ` for owner=${ownerId}` : ' globally'}`);
    } else {
      logger.info(`[CRON-V2] Generated 0 monthly rent records`);
    }

    return billingResults;
  } catch (err) {
    logger.error(`[BILLING ERROR] generateMonthlyBills: ${err.message}`);
    emailService.sendSystemFailureAlert('generateMonthlyBills Failed', err.stack).catch(() => null);
    throw err;
  }
};

/**
 * processBillingRemindersAndOverdue(ownerId?, tenantId?)
 * Marks records as overdue and implements the 1, 7, 15, 21, 30 day overdue cadence.
 */
const updateOverduePayments = async (ownerId, forceReminders = false, tenantId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {
      status: { $in: ['pending', 'partial', 'overdue'] },
    };
    if (ownerId) query.ownerId = ownerId;
    if (tenantId) query.tenantId = tenantId;

    const records = await MonthlyRentRecord.find(query)
      .populate('userId')
      .populate('propertyId')
      .populate('roomId')
      .populate('ownerId');

    let overdueMarked = 0;

    for (const record of records) {
      if (!record.dueDate) continue;

      const dueDate = new Date(record.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Guard: prevent newly generated rent records from being marked overdue during the same cron run
      const isCreatedToday = record.createdAt && record.createdAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
      if (isCreatedToday) {
        logger.info(`[OVERDUE DEBUG] Skipping overdue processing for newly generated bill ${record._id}`);
        continue;
      }

      let diffDays = 0;
      if (today > dueDate) {
        const diffTime = today.getTime() - dueDate.getTime();
        diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      logger.info(`[OVERDUE DEBUG] currentDate=${today.toISOString()} dueDate=${dueDate.toISOString()} billMonth=${record.month} generatedAt=${record.createdAt ? record.createdAt.toISOString() : 'Unknown'} diffDays=${diffDays}`);

      // Mark as overdue if past due date (Only for pending. Partial stays partial)
      if (diffDays > 0 && record.status === 'pending') {
        try {
          const result = await MonthlyRentRecord.updateOne(
            {
              _id: record._id,
              status: 'pending'
            },
            {
              $set: {
                status: 'overdue',
                overdueMarkedAt: new Date()
              }
            }
          );
          
          if (result.modifiedCount > 0 || result.upsertedCount > 0) {
            record.status = 'overdue'; // Update local object for subsequent email logic
            overdueMarked++;
            logger.info(`[OVERDUE UPDATE] record=${record._id} status set to overdue`);
          }
        } catch (updateErr) {
          logger.error(`[BILLING ERROR] Failed to mark record ${record._id} overdue: ${updateErr.message}`);
          continue;
        }
      } else if (diffDays > 0 && record.status === 'overdue' && record.totalPaid > 0) {
        // SELF-HEALING: Revert records that were incorrectly marked overdue by older cron versions
        try {
          await MonthlyRentRecord.updateOne(
            { _id: record._id },
            { $set: { status: 'partial' } }
          );
          record.status = 'partial';
          logger.info(`[OVERDUE HEALED] record=${record._id} reverted to partial`);
        } catch (healErr) {
          logger.error(`[BILLING HEAL ERROR] ${healErr.message}`);
        }
      }

      // Check if we already sent a reminder today
      if (record.reminderSentAt && !forceReminders) {
        const lastSent = new Date(record.reminderSentAt);
        lastSent.setHours(0, 0, 0, 0);
        if (lastSent.getTime() === today.getTime()) continue;
      }

      // Check Cadence rules (Robust milestone-based logic)
      let shouldSend = false;
      let emailType = '';

      if (diffDays === -1) {
        shouldSend = true;
        emailType = 'due_tomorrow';
      } else if (diffDays === 0) {
        shouldSend = true;
        emailType = 'due_today';
      } else if (diffDays > 0 && (record.status === 'overdue' || record.status === 'partial' || record.status === 'pending')) {
        // Milestones: 1, 5, 10, 15, 20, 25 days
        const milestones = [1, 5, 10, 15, 20, 25, 30];
        
        // Find the highest milestone currently reached
        const currentHighestMilestone = [...milestones].reverse().find(m => diffDays >= m);
        logger.info(`[OVERDUE DEBUG] MilestoneReached=${currentHighestMilestone || 'None'}`);

        if (currentHighestMilestone) {
          if (!record.reminderSentAt) {
            // Never sent an overdue reminder yet
            shouldSend = true;
            emailType = 'overdue';
            logger.info(`[OVERDUE DEBUG] Decided: SEND (Never sent before)`);
          } else {
            // We have sent a reminder before. 
            // We need to check if the last one was for an EARLIER milestone.
            const lastSent = new Date(record.reminderSentAt);
            lastSent.setHours(0, 0, 0, 0);
            
            // Calculate how many days past due it was when we last sent it
            const lastDiffTime = lastSent.getTime() - dueDate.getTime();
            const lastDiffDays = Math.floor(lastDiffTime / (1000 * 60 * 60 * 24));
            
            // What was the highest milestone reached at the time of the last reminder?
            const lastMilestoneReached = [...milestones].reverse().find(m => lastDiffDays >= m);
            logger.info(`[OVERDUE DEBUG] LastMilestoneWas=${lastMilestoneReached || 'None'}`);

            // If the current milestone is strictly greater than the last one reached, we send a new one
            if (!lastMilestoneReached || currentHighestMilestone > lastMilestoneReached) {
              shouldSend = true;
              emailType = 'overdue';
              logger.info(`[OVERDUE DEBUG] Decided: SEND (New milestone)`);
            } else {
              logger.info(`[OVERDUE DEBUG] Decided: SKIP (Milestone already notified)`);
            }
          }
        } else {
          logger.info(`[OVERDUE DEBUG] Decided: SKIP (No milestone reached yet)`);
        }
      }

      if (shouldSend) {
        if (emailType === 'due_tomorrow' && record.userId) {
          await emailService.sendDueSoonReminderEmail(record.userId, record, record.propertyId, record.roomId).catch(() => null);
        } else if (emailType === 'due_today' && record.userId) {
          await emailService.sendDueTodayReminderEmail(record.userId, record, record.propertyId, record.roomId).catch(() => null);
        } else if (emailType === 'overdue' && record.userId) {
          await emailService.sendOverdueAlert(record.userId, record, record.propertyId, record.roomId, record.ownerId).catch(() => null);
        }
        try {
          await MonthlyRentRecord.updateOne(
            { _id: record._id },
            { 
              $set: { 
                reminderSent: true, 
                reminderSentAt: new Date() 
              } 
            }
          );
          record.reminderSent = true;
          record.reminderSentAt = new Date();
        } catch (updateErr) {
          logger.error(`[BILLING ERROR] Failed to save reminder status for record ${record._id}: ${updateErr.message}`);
        }
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
    const query = {};
    if (ownerId) query.ownerId = ownerId;

    if (filters.propertyId) {
      query.propertyId = filters.propertyId;
    }
    
    if (filters.month) {
      query.month = filters.month;
    }

    // ── All-time aggregate from MonthlyRentRecords ──
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

    // ── Today's collections from PaymentTransactions ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const txQuery = { status: 'completed', paymentDate: { $gte: todayStart, $lte: todayEnd } };
    if (ownerId) txQuery.ownerId = ownerId;
    if (filters.propertyId) txQuery.propertyId = filters.propertyId;
    txQuery.amount = { $gt: 0 };

    const PaymentTransaction = require('../models/PaymentTransaction');
    const todayResult = await PaymentTransaction.aggregate([
      { $match: txQuery },
      { $group: { _id: null, collectionsToday: { $sum: '$amount' } } }
    ]);
    const collectionsToday = todayResult.length > 0 ? todayResult[0].collectionsToday : 0;

    const base = metrics.length > 0 ? metrics[0] : {
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

    return { ...base, collectionsToday };
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
