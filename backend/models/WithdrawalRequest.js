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
      trim: true,
      default: null
    },
    ifscCode: {
      type: String,
      trim: true,
      default: null
    },
    accountHolderName: {
      type: String,
      trim: true,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'qr_generated', 'paid', 'completed', 'rejected'],
      default: 'pending',
      index: true
    },
    qrGeneratedAt: {
      type: Date,
      default: null
    },
    qrGeneratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    utrNumber: {
      type: String,
      trim: true,
      default: null
    },
    settlementMethod: {
      type: String,
      enum: ['upi_qr', 'upi_manual', 'bank_transfer', 'cash', null],
      default: null
    },
    settlementReference: {
      type: String,
      trim: true,
      default: null
    },
    paidAt: {
      type: Date,
      default: null
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    remarks: {
      type: String,
      trim: true,
      default: null
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
