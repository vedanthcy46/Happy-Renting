'use strict';

const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
      default: null
    },
    type: {
      type: String,
      enum: [
        'cash_receipt',
        'bank_receipt',
        'tenant_receivable',
        'advance_liability',
        'rent_revenue',
        'refund_payout',
        'adjustment'
      ],
      required: true
    },
    debit: {
      type: Number,
      default: 0
    },
    credit: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number,
      required: true
    },
    reference: {
      type: String, // e.g. "Rent Due for May 2026", "Advance applied to June"
      required: true
    }
  },
  {
    timestamps: true
  }
);

ledgerEntrySchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
