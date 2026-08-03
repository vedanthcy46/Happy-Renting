'use strict';

/**
 * fix_due_dates_postpaid.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backfill for existing MonthlyRentRecords created before the postpaid due-date
 * fix.
 *
 * Under our postpaid model a bill for occupancy `month` M is generated in
 * month M+1, so its rent is due on the 5th of M+1 (NOT the 5th of M, which is
 * already in the past). Records created by the old code have `dueDate` anchored
 * to the 5th of M, which made them look overdue the moment they were saved.
 *
 * This script:
 *   1. Re-anchors every record's `dueDate` to the 5th of the month following
 *      its occupancy `month`.
 *   2. Recalculates status via the model pre-save hook, healing records that
 *      were incorrectly flipped to `overdue` (e.g. a bill now due in the future
 *      reverts to `pending`; a bill with `totalPaid > 0` reverts to `partial`).
 *
 * Usage:
 *   node scripts/fix_due_dates_postpaid.js             # real run
 *   node scripts/fix_due_dates_postpaid.js --dry-run   # preview only
 *   node scripts/fix_due_dates_postpaid.js --from=2026-06   # limit to a month
 */

require('dotenv').config({ path: __dirname + '/../.env' });

const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const { calculateDueDate } = require('../utils/billingCalculationService');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fromArg = args.find((a) => a.startsWith('--from='));
const FROM_MONTH = fromArg ? fromArg.split('=')[1] : null;

/**
 * Returns the month string that FOLLOWS the given occupancy month,
 * i.e. '2026-07' -> '2026-08', and '2026-12' -> '2027-01'.
 */
const nextMonthStr = (month) => {
  const [year, monthNum] = month.split('-').map(Number);
  let nextYear = year;
  let nextMonth = monthNum + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const query = {};
  if (FROM_MONTH) query.month = { $gte: FROM_MONTH };

  const records = await MonthlyRentRecord.find(query);
  console.log(`Found ${records.length} records to evaluate${DRY_RUN ? ' (DRY RUN)' : ''}.`);

  let reanchored = 0;
  let healed = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      const dueMonth = nextMonthStr(record.month);
      const correctDue = calculateDueDate(dueMonth);
      correctDue.setHours(0, 0, 0, 0);

      const currentDue = record.dueDate ? new Date(record.dueDate) : null;
      currentDue?.setHours(0, 0, 0, 0);

      const sameDay =
        currentDue &&
        correctDue.getTime() === currentDue.getTime();

      if (sameDay) {
        skipped++;
        continue;
      }

      const before = {
        dueDate: record.dueDate ? new Date(record.dueDate).toISOString() : null,
        status: record.status,
      };

      if (!DRY_RUN) {
        record.dueDate = correctDue;
        await record.save(); // pre-save hook recalculates status + remaining
      }

      const afterStatus = DRY_RUN ? '(recalc on save)' : record.status;
      reanchored++;
      // Count a heal whenever the status differs (dry-run: expected status diff)
      if (DRY_RUN) {
        healed++;
      } else if (before.status !== record.status) {
        healed++;
      }

      console.log(
        `  ${record._id} month=${record.month} due ${before.dueDate} -> ${correctDue.toISOString()} | ${before.status} -> ${afterStatus}`
      );
    } catch (err) {
      console.error(`  ERROR record ${record._id}: ${err.message}`);
    }
  }

  console.log('\nSummary:');
  console.log(`  Re-anchored due dates : ${reanchored}`);
  console.log(`  Status changes         : ${healed}`);
  console.log(`  Skipped (already ok)   : ${skipped}`);
  if (DRY_RUN) {
    console.log('\nDry run completed. Run without --dry-run to apply changes.');
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});