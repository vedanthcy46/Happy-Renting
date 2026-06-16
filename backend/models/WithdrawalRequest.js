'use strict';

const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero']
    },
    bankAccountNumber: {
      type: String,
      required: [true, 'Bank account number is required'],
      trim: true
    },
    ifscCode: {
      type: String,
      required: [true, 'IFSC code is required'],
      trim: true
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'completed', 'rejected'],
      default: 'pending',
      index: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: {
      type: Date,
      default: null
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null
    },
    settlementDetails: {
      transferType: {
        type: String,
        enum: ['upi', 'neft', 'rtgs', 'imps', 'bank_transfer', 'other', null],
        default: null
      },
      referenceNumber: {
        type: String,
        trim: true,
        default: null
      },
      note: {
        type: String,
        trim: true,
        default: null
      }
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

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
