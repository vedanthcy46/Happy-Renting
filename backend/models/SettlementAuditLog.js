'use strict';

const mongoose = require('mongoose');

const settlementAuditLogSchema = new mongoose.Schema(
  {
    withdrawalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WithdrawalRequest',
      required: [true, 'Withdrawal Request ID is required'],
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin ID is required'],
      index: true
    },
    action: {
      type: String,
      enum: ['qr_generated', 'settlement_completed', 'settlement_rejected'],
      required: [true, 'Action is required']
    },
    oldStatus: {
      type: String,
      required: [true, 'Old status is required']
    },
    newStatus: {
      type: String,
      required: [true, 'New status is required']
    },
    ipAddress: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
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

module.exports = mongoose.model('SettlementAuditLog', settlementAuditLogSchema);
