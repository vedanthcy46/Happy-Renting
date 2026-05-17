'use strict';

const mongoose = require('mongoose');

const migrationHistorySchema = new mongoose.Schema(
  {
    migrationId: {
      type    : String,
      required: [true, 'Migration ID is required'],
      unique  : true,
      trim    : true,
    },
    completedAt: {
      type   : Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MigrationHistory', migrationHistorySchema);
