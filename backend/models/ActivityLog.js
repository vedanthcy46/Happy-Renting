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
        'TENANT_ADDED', 'TENANT_VACATED', 'CO_OCCUPANT_ADDED',
        'PAYMENT_RECORDED', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED',
        'COMPLAINT_UPDATED'
      ],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId, // Could be Property, Room, Tenant, Payment, Complaint
      required: true,
    },
    targetModel: {
      type: String,
      enum: ['Property', 'Room', 'Tenant', 'Payment', 'Complaint'],
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
