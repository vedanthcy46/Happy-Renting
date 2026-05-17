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
      enum    : ['active', 'vacated'],
      default : 'active',
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
  foreignField: 'tenantId',
  match: { status: 'active' }
});

// ── Business rule: a user can only be an active tenant once ────────────────
tenantSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
tenantSchema.index({ roomId: 1, status: 1 });
tenantSchema.index({ ownerId: 1 });
tenantSchema.index({ propertyId: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
