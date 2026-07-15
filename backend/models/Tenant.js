'use strict';

const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    // Reference to the User account of this tenant
    userId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'User reference is required'],
    },
    roomId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Room',
      required : [true, 'Room is required'],
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
    joinDate: {
      type    : Date,
      required: [true, 'Join date is required'],
      default : Date.now,
    },
    phone: {
      type     : String,
      trim     : true,
      required : [true, 'Phone number is required'],
    },
    idProof: {
      type     : String,
      trim     : true,
      default  : '',
    },
    exitDate: {
      type   : Date,
      default: null,
    },
    advancePaid: {
      type   : Number,
      default: 0,
      min    : [0, 'Advance paid cannot be negative'],
    },
    securityDeposit: {
      type   : Number,
      default: 0,
      min    : [0, 'Security deposit cannot be negative'],
    },
    status: {
      type    : String,
      enum    : ['active', 'vacated', 'deletion_requested', 'pending_deletion', 'deleted'],
      default : 'active',
    },
    deletionRequestedAt: {
      type: Date,
      default: null,
    },
    deletionApprovedAt: {
      type: Date,
      default: null,
    },
    deletionApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletionReason: {
      type: String,
      trim: true,
      default: '',
    },
    deletionScheduledFor: {
      type: Date,
      default: null,
    },
    deletionRejectedAt: {
      type: Date,
      default: null,
    },
    deletionRejectedReason: {
      type: String,
      trim: true,
      default: '',
    },
    deletionCancelledAt: {
      type: Date,
      default: null,
    },
    refundSettled: {
      type: Boolean,
      default: false
    },
    refundSettledAt: {
      type: Date,
      default: null
    },
    refundNote: {
      type: String,
      default: ''
    },
    advanceRefundAmount: {
      type: Number,
      default: 0
    },
    rentDueDay: {
      type   : Number,
      min    : [1, 'Rent due day must be at least 1'],
      max    : [31, 'Rent due day cannot exceed 31'],
      default: 5,
    },
    notes: {
      type     : String,
      trim     : true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    vacatedBy: {
      type   : mongoose.Schema.Types.ObjectId,
      ref    : 'User',
      default: null,
    },
    privacyDataPurged: {
      type   : Boolean,
      default: false,
    },
    moveInDate: {
      type   : Date,
      default: null,
    },
    customBillingDay: {
      type   : Number,
      min    : [1, 'Custom billing day must be at least 1'],
      max    : [31, 'Custom billing day cannot exceed 31'],
      default: null,
    },
    billingDay: {
      type   : Number,
      default: null,
    },
    firstBillingDate: {
      type   : Date,
      default: null,
    },
    isMigratedTenant: {
      type   : Boolean,
      default: false,
    },
    migrationBackfillCompleted: {
      type   : Boolean,
      default: false,
    },
    ledgerLocked: {
      type: Boolean,
      default: false,
    },
    ledgerLockedAt: {
      type: Date,
      default: null,
    },
    ledgerVersion: {
      type: Number,
      default: 1,
    },
    totalPaid: { type: Number, default: 0 },
    totalRent: { type: Number, default: 0 },
    advanceBalance: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual for co-occupants
tenantSchema.virtual('coOccupants', {
  ref: 'CoOccupant',
  localField: '_id',
  foreignField: 'tenantId'
});

// ── Business rule: a user can only be an active tenant once ────────────────
tenantSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
tenantSchema.index({ roomId: 1, status: 1 });
tenantSchema.index({ ownerId: 1 });
tenantSchema.index({ propertyId: 1 });
tenantSchema.index({ ownerId: 1, status: 1, propertyId: 1 });

// Pre-save hook: compute billingDay, firstBillingDate and sync rentDueDay
tenantSchema.pre('save', function() {
  // 1. Ensure moveInDate defaults to joinDate or current time
  if (!this.moveInDate) {
    this.moveInDate = this.joinDate || new Date();
  }

  // 2. Compute billingDay: use customBillingDay if set, otherwise use global default
  const GLOBAL_DUE_DAY = 5;
  if (this.customBillingDay) {
    this.billingDay = this.customBillingDay;
  } else {
    this.billingDay = GLOBAL_DUE_DAY;
  }

  // Also sync the legacy rentDueDay field so we don't break legacy queries or controllers
  this.rentDueDay = this.billingDay;

  // 3. Compute firstBillingDate: must NEVER start in the same cycle as move-in
  // Only calculate ONCE when the stay is first created or if firstBillingDate is missing
  if (!this.firstBillingDate) {
    const moveIn = new Date(this.moveInDate);
    let year = moveIn.getFullYear();
    let month = moveIn.getMonth(); // 0-11
    
    // Start with the next calendar month
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    
    // Set to billingDay
    const tempDate = new Date(year, month, this.billingDay, 12, 0, 0, 0);
    // If the day got wrapped (e.g. 31st in Feb), cap it to the last day of the target month
    if (tempDate.getMonth() !== (month % 12)) {
      this.firstBillingDate = new Date(year, month + 1, 0, 12, 0, 0, 0); // Last day of target month
    } else {
      this.firstBillingDate = tempDate;
    }
  }
});

module.exports = mongoose.model('Tenant', tenantSchema);
