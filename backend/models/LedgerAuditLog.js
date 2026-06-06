'use strict';

const mongoose = require('mongoose');

const ledgerAuditLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerJob',
      required: true
    },
    triggerSource: {
      type: String,
      required: true
    },
    oldVersion: {
      type: Number,
      required: true
    },
    newVersion: {
      type: Number,
      required: true
    },
    monthsAffected: {
      type: [String],
      default: []
    },
    beforeTotals: {
      totalPaid: { type: Number, default: 0 },
      totalRent: { type: Number, default: 0 },
      advanceBalance: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 }
    },
    afterTotals: {
      totalPaid: { type: Number, default: 0 },
      totalRent: { type: Number, default: 0 },
      advanceBalance: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 }
    },
    durationMs: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

ledgerAuditLogSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerAuditLog', ledgerAuditLogSchema);
