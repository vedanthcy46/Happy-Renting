'use strict';

const mongoose = require('mongoose');

const ownerWalletSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      unique: true
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: [0, 'Available balance cannot be negative']
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: [0, 'Pending balance cannot be negative']
    },
    totalReceived: {
      type: Number,
      default: 0,
      min: [0, 'Total received cannot be negative']
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: [0, 'Total withdrawn cannot be negative']
    },
    totalGatewayCharges: {
      type: Number,
      default: 0,
      min: [0, 'Total gateway charges cannot be negative']
    },
    totalSubscriptionFees: {
      type: Number,
      default: 0,
      min: [0, 'Total subscription fees cannot be negative']
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    },
    lastSettlementDate: {
      type: Date,
      default: null
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

module.exports = mongoose.model('OwnerWallet', ownerWalletSchema);
