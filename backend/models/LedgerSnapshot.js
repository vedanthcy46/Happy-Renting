'use strict';

const mongoose = require('mongoose');

const ledgerSnapshotSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true
    },
    ledgerVersion: {
      type: Number,
      required: true
    },
    asOfMonth: {
      type: String, // format YYYY-MM
      required: true
    },
    balances: {
      totalPaid: { type: Number, default: 0 },
      totalRent: { type: Number, default: 0 },
      advanceBalance: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 }
    },
    rentRecords: {
      type: Array, // Store partial or complete rent records state up to this month
      default: []
    },
    transactions: {
      type: Array, // Store partial or complete transactions state up to this month
      default: []
    },
    checksum: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

ledgerSnapshotSchema.index({ tenantId: 1, asOfMonth: 1 });
ledgerSnapshotSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerSnapshot', ledgerSnapshotSchema);
