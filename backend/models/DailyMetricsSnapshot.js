'use strict';

const mongoose = require('mongoose');

const dailyMetricsSnapshotSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null means platform-wide metrics for superadmins
    },
    date: {
      type: String,
      required: true,
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Idempotency and fast lookups
dailyMetricsSnapshotSchema.index({ ownerId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyMetricsSnapshot', dailyMetricsSnapshotSchema);
