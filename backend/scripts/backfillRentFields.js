'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const logger = require('../config/logger');
const connectDB = require('../config/db');

/**
 * backfillRentFields.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Safe migration script to backfill `fullRentAmount` and `rentAmountAtGeneration`
 * for legacy records migrated from V1.
 */
const main = async () => {
  try {
    await connectDB();
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Legacy Rent Record Field Backfill (V2)        ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    if (isDryRun) {
      console.log('⚠️  DRY RUN MODE - No data will be modified\n');
    }

    // Find all records that haven't been migrated or are missing fields
    const query = {
      $or: [
        { migrationVersion: { $exists: false } },
        { migrationVersion: 0 },
        { fullRentAmount: { $exists: false } },
        { fullRentAmount: null },
        { rentAmountAtGeneration: { $exists: false } },
        { rentAmountAtGeneration: null }
      ]
    };

    const count = await MonthlyRentRecord.countDocuments(query);
    console.log(`Found ${count} records requiring backfill.\n`);

    if (count === 0) {
      console.log('All records are up to date. Exiting.');
      process.exit(0);
    }

    // Process in batches using a cursor
    const cursor = MonthlyRentRecord.find(query).cursor();
    
    let processed = 0;
    let modified = 0;
    let errors = 0;

    for await (const record of cursor) {
      processed++;
      try {
        const updateDoc = {
          $set: {
            migrationVersion: 1
          }
        };

        if (record.fullRentAmount == null) {
          updateDoc.$set.fullRentAmount = record.totalRent;
        }
        if (record.rentAmountAtGeneration == null) {
          updateDoc.$set.rentAmountAtGeneration = record.totalRent;
        }

        if (isDryRun) {
          modified++;
          continue;
        }

        // Use updateOne to bypass Mongoose validation in case other fields are invalid
        const result = await MonthlyRentRecord.updateOne(
          { _id: record._id },
          updateDoc
        );

        if (result.modifiedCount > 0) {
          modified++;
        }
        
        if (processed % 100 === 0) {
          console.log(`Processed ${processed}/${count}...`);
        }
      } catch (err) {
        errors++;
        logger.error(`[BACKFILL ERROR] Record ${record._id}: ${err.message}`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Backfill Summary                              ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    console.log(`Total Scanned: ${processed}`);
    console.log(isDryRun ? `Would Modify : ${modified}` : `Modified     : ${modified}`);
    console.log(`Errors       : ${errors}`);

    if (errors === 0 && !isDryRun) {
      console.log('\n✅ Backfill completed successfully.');
    } else if (errors > 0) {
      console.log('\n⚠️ Backfill completed with errors. Check logs.');
    }

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
