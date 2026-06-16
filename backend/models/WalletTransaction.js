'use strict';

const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null
    },
    rentRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonthlyRentRecord',
      default: null
    },
    paymentTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
      default: null
    },
    grossAmount: {
      type: Number,
      required: [true, 'Gross amount is required']
    },
    gatewayFee: {
      type: Number,
      default: 0
    },
    platformFee: {
      type: Number,
      default: 0
    },
    netAmount: {
      type: Number,
      required: [true, 'Net amount is required']
    },
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before is required']
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after is required']
    },
    type: {
      type: String,
      enum: [
        'rent_received',
        'withdrawal',
        'refund',
        'adjustment',
        'subscription_fee',
        'commission_fee',
        'settlement',
        'reversal'
      ],
      required: [true, 'Transaction type is required']
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required']
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes
walletTransactionSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
