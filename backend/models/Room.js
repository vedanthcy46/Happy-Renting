'use strict';

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type     : String,
      required : [true, 'Room number is required'],
      trim     : true,
      maxlength: [20, 'Room number cannot exceed 20 characters'],
    },
    propertyId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Property',
      required : [true, 'Property is required'],
    },
    ownerId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'Owner is required'],
    },
    capacity: {
      type    : Number,
      required: [true, 'Capacity is required'],
      min     : [1, 'Capacity must be at least 1'],
      max     : [20, 'Capacity cannot exceed 20'],
    },

    /**
     * currentOccupancy is maintained atomically via $inc in transactions.
     * Never trust frontend values — always update via server-controlled $inc.
     * Constraints enforced at write time (not just at schema level):
     *   - Cannot exceed capacity   (checked in tenantService before $inc)
     *   - Cannot go below 0        (guarded by $gte: 1 condition in move-out)
     */
    currentOccupancy: {
      type    : Number,
      default : 0,
      min     : [0, 'Occupancy cannot be negative'],
    },

    floor: {
      type : String,
      trim : true,
      maxlength: [10, 'Floor cannot exceed 10 characters'],
    },
    monthlyRent: {
      type   : Number,
      min    : [0, 'Monthly rent cannot be negative'],
      default: 0,
    },
    securityDeposit: {
      type   : Number,
      min    : [0, 'Security deposit cannot be negative'],
      default: 0,
    },
    description: {
      type     : String,
      trim     : true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    isActive: {
      type   : Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        // Derived field — always computed from stored values
        ret.isFull = ret.currentOccupancy >= ret.capacity;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.isFull = ret.currentOccupancy >= ret.capacity;
        return ret;
      },
    },
  }
);

// ── Compound unique index: room number unique per property (ACTIVE ONLY) ──
roomSchema.index(
  { propertyId: 1, roomNumber: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
roomSchema.index({ ownerId: 1 });

// ── Compound index for fast occupancy lookups ──────────────────────────────
roomSchema.index({ ownerId: 1, isActive: 1 });

module.exports = mongoose.model('Room', roomSchema);
