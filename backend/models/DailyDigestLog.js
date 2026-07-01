'use strict';

const mongoose = require('mongoose');

const dailyDigestLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'superadmin'],
      required: true,
    },
    digestType: {
      type: String,
      enum: ['owner_daily', 'admin_daily', 'owner_weekly', 'admin_weekly', 'owner_monthly'],
      required: true,
    },
    digestDate: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed', 'dead_letter'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    workerId: {
      type: String,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    templateVersion: {
      type: String,
      default: 'v1',
    },
  },
  {
    timestamps: true,
  }
);

// Idempotency: Prevent duplicate emails for the same user, date, and type
dailyDigestLogSchema.index({ userId: 1, digestDate: 1, digestType: 1 }, { unique: true });

// Worker Queries: Quickly find pending/processing jobs
dailyDigestLogSchema.index({ status: 1, digestDate: 1 });
dailyDigestLogSchema.index({ processingStartedAt: 1 });

module.exports = mongoose.model('DailyDigestLog', dailyDigestLogSchema);
