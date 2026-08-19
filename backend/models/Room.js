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

    /**
     * Property type: 'rental' = one tenant per room, 'pg' = bed-level
     * management (multiple residents per room, each assigned a bed).
     */
    type: {
      type: String,
      enum: ['rental', 'pg'],
      default: 'rental',
    },

    /**
     * Bed-level management (PG). Each bed is an embedded subdocument with its
     * own _id so tenants can reference a specific bed via `bedId`.
     * - 'occupied' is ALWAYS set by tenantService on move-in (never by the
     *   bed-status endpoint directly).
     * - 'available' | 'reserved' | 'maintenance' are managed by the owner.
     * For 'rental' rooms this array stays empty and currentOccupancy/capacity
     * behave exactly as before.
     */
    beds: [
      {
        bedNumber: {
          type     : String,
          required : [true, 'Bed number is required'],
          trim     : true,
          maxlength: [20, 'Bed number cannot exceed 20 characters'],
        },
        status: {
          type: String,
          enum: ['available', 'occupied', 'reserved', 'maintenance'],
          default: 'available',
        },
        currentTenantId: {
          type    : mongoose.Schema.Types.ObjectId,
          ref     : 'Tenant',
          default : null,
        },
        deposit: {
          type   : Number,
          min    : [0, 'Bed deposit cannot be negative'],
          default: 0,
        },
        monthlyRent: {
          type   : Number,
          min    : [0, 'Bed monthly rent cannot be negative'],
          default: 0,
        },
      },
    ],
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
        // Bed-level stats — only meaningful for PG rooms
        const beds = Array.isArray(ret.beds) ? ret.beds : [];
        ret.totalBeds = beds.length;
        ret.occupiedBeds = beds.filter(b => b.status === 'occupied').length;
        ret.availableBeds = beds.filter(b => b.status === 'available').length;
        ret.reservedBeds = beds.filter(b => b.status === 'reserved').length;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.isFull = ret.currentOccupancy >= ret.capacity;
        const beds = Array.isArray(ret.beds) ? ret.beds : [];
        ret.totalBeds = beds.length;
        ret.occupiedBeds = beds.filter(b => b.status === 'occupied').length;
        ret.availableBeds = beds.filter(b => b.status === 'available').length;
        ret.reservedBeds = beds.filter(b => b.status === 'reserved').length;
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
