'use strict';

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Tenant',
      required : [true, 'Tenant reference is required'],
    },
    userId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'User reference is required'],
    },
    roomId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Room',
      required : [true, 'Room reference is required'],
    },
    propertyId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Property',
      required : [true, 'Property reference is required'],
    },
    ownerId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'Owner reference is required'],
    },
    // Format: "YYYY-MM" e.g. "2024-05"
    month: {
      type    : String,
      required: [true, 'Payment month is required'],
      match   : [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'],
    },
    amount: {
      type    : Number,
      required: [true, 'Amount is required'],
      min     : [0, 'Amount cannot be negative'],
    },
    method: {
      type    : String,
      enum    : ['cash', 'bank_transfer', 'cheque', 'online', 'other'],
      default : 'cash',
    },
    status: {
      type    : String,
      enum    : ['paid', 'pending', 'partial', 'processing', 'failed', 'verification_pending', 'overdue'],
      default : 'pending',
    },
    dueDate: {
      type: Date,
    },
    transactionId: {
      type : String,
      trim : true,
    },
    paidDate: {
      type    : Date,
    },
    notes: {
      type     : String,
      trim     : true,
      maxlength: [300, 'Notes cannot exceed 300 characters'],
    },
    reminderSent: {
      type   : Boolean,
      default: false,
    },
    proofImage: {
      secureUrl: { type: String },
      publicId : { type: String },
    },
    failureReason: {
      type     : String,
      trim     : true,
      maxlength: [300, 'Failure reason cannot exceed 300 characters'],
    },
    // Who recorded this payment (owner or superadmin)
    recordedBy: {
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'User',
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

// ── One payment record per tenant per month ────────────────────────────────
paymentSchema.index({ tenantId: 1, month: 1 }, { unique: true });
paymentSchema.index({ ownerId: 1 });
paymentSchema.index({ propertyId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
