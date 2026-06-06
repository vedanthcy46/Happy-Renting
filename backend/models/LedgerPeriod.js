'use strict';

const mongoose = require('mongoose');

const ledgerPeriodSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true
    },
    month: {
      type: String, // format YYYY-MM
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open'
    },
    closedAt: {
      type: Date,
      default: null
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

ledgerPeriodSchema.index({ tenantId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('LedgerPeriod', ledgerPeriodSchema);
