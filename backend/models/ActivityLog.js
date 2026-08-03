'use strict';

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actionType: {
      type: String,
      enum: [
        'PROPERTY_CREATED', 'PROPERTY_UPDATED', 'PROPERTY_DELETED',
        'ROOM_CREATED', 'ROOM_UPDATED', 'ROOM_DELETED',
        'TENANT_ADDED', 'TENANT_VACATED', 'CO_OCCUPANT_ADDED', 'CO_OCCUPANT_REMOVED',
        'MOVEOUT_REQUESTED', 'REFUND_SETTLED',
        'PAYMENT_RECORDED', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED',
        'PAYMENT_TRANSACTION_ADDED', 'PAYMENT_TRANSACTION_REVERSED',
        'PAYMENT_TRANSACTION_VERIFIED', 'PAYMENT_TRANSACTION_REJECTED',
        'RENT_RECORD_UPDATED',
        'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED',
        'COMPLAINT_UPDATED'
      ],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId, // Could be Property, Room, Tenant, Payment, Complaint, PaymentTransaction, MonthlyRentRecord
      required: true,
    },
    targetModel: {
      type: String,
      enum: ['Property', 'Room', 'Tenant', 'Payment', 'Complaint', 'PaymentTransaction', 'MonthlyRentRecord', 'Expense'],
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    ipAddress: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ ownerId: 1, createdAt: -1 });
activityLogSchema.index({ actionType: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
