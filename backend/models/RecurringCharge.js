'use strict';

const mongoose = require('mongoose');

/**
 * RecurringCharge
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores per-tenant recurring charges that are automatically added to every
 * monthly bill (e.g. water, maintenance, internet). The owner only needs to
 * add variable charges (electricity) manually each month.
 */
const recurringChargeSchema = new mongoose.Schema(
  {
    tenantId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    ownerId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'User',
      required: [true, 'Owner reference is required'],
    },
    propertyId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Property',
      required: [true, 'Property reference is required'],
    },
    roomId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Room',
      required: [true, 'Room reference is required'],
    },
    type: {
      type   : String,
      enum   : ['WATER', 'MAINTENANCE', 'INTERNET', 'GAS', 'PARKING', 'CLEANING', 'SOCIETY', 'GARBAGE', 'OTHER'],
      required: [true, 'Charge type is required'],
    },
    description: {
      type     : String,
      trim     : true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      required : [true, 'Description is required'],
    },
    amount: {
      type   : Number,
      min    : [0, 'Amount cannot be negative'],
      required: [true, 'Amount is required'],
    },
    isActive: {
      type   : Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

recurringChargeSchema.index({ tenantId: 1, isActive: 1 });
recurringChargeSchema.index({ ownerId: 1 });

module.exports = mongoose.model('RecurringCharge', recurringChargeSchema);
