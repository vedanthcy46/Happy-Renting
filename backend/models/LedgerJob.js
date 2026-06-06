'use strict';

const mongoose = require('mongoose');

const ledgerJobSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required for a ledger job']
    },
    type: {
      type: String,
      default: 'ledger_rebuild',
      required: true
    },
    triggerSource: {
      type: String,
      enum: [
        'transaction_created',
        'transaction_reversed',
        'rent_updated',
        'move_out',
        'migration_fix',
        'manual_admin',
        'settlement_adjusted'
      ],
      required: true
    },
    affectedMonth: {
      type: String,
      default: null // If null, means rebuild from start or determined dynamically
    },
    priority: {
      type: String,
      enum: ['high', 'normal', 'low'],
      default: 'normal'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'dead_letter'],
      default: 'pending'
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    error: {
      type: String,
      default: null
    },
    lastHeartbeatAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes to speed up queue workers
ledgerJobSchema.index({ status: 1, priority: 1, createdAt: 1 });
ledgerJobSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('LedgerJob', ledgerJobSchema);
