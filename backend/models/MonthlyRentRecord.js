'use strict';

const mongoose = require('mongoose');

const monthlyRentRecordSchema = new mongoose.Schema(
  {
    // Reference to the tenant's stay
    tenantId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Tenant',
      required : [true, 'Tenant reference is required'],
    },
    userId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'User (tenant) reference is required'],
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
      required: [true, 'Month is required'],
      match   : [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'],
    },
    // ─────────────────────────────────────────────────────────────────────
    // RENT AMOUNT FIELDS
    // ─────────────────────────────────────────────────────────────────────
    // What is the monthly rent due?
    totalRent: {
      type    : Number,
      required: [true, 'Total rent is required'],
      min     : [0, 'Total rent cannot be negative'],
    },
    // Snapshot of the rent amount at the exact time this record was generated
    rentAmountAtGeneration: {
      type    : Number,
      required: [true, 'Snapshot of rent amount is required'],
    },
    // How much has been paid (sum of all transactions)?
    // This is calculated, but stored for quick access
    totalPaid: {
      type   : Number,
      default: 0,
      min    : [0, 'Total paid cannot be negative'],
    },
    // How much still needs to be paid?
    remainingAmount: {
      type   : Number,
      default: function() {
        return this.totalRent - this.totalPaid;
      },
      min    : [0, 'Remaining amount cannot be negative'],
    },
    // ─────────────────────────────────────────────────────────────────────
    // STATUS & DATES
    // ─────────────────────────────────────────────────────────────────────
    status: {
      type    : String,
      enum    : ['pending', 'partial', 'paid', 'overdue', 'overpaid'],
      default : 'pending',
    },
    dueDate: {
      type: Date,
    },
    paidOnDate: {
      type: Date, // When was it fully paid?
      default: null,
    },
    // ─────────────────────────────────────────────────────────────────────
    // METADATA
    // ─────────────────────────────────────────────────────────────────────
    // Admin notes about this month's rent
    notes: {
      type     : String,
      trim     : true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    // Has a due reminder been sent?
    reminderSent: {
      type   : Boolean,
      default: false,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    // For refunds or overpayments carried to next month
    advanceBalance: {
      type   : Number,
      default: 0,
      min    : [0, 'Advance balance cannot be negative'],
    },
    // Controls how advance balance is treated in future months
    advanceBalanceMode: {
      type    : String,
      enum    : ['auto_apply', 'manual_apply'],
      default : 'auto_apply',
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // Enables __v checking on save()
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────
// One rent record per tenant per month
monthlyRentRecordSchema.index({ tenantId: 1, month: 1 }, { unique: true });
monthlyRentRecordSchema.index({ ownerId: 1, month: 1 });
monthlyRentRecordSchema.index({ propertyId: 1, month: 1 });
monthlyRentRecordSchema.index({ status: 1 });

// ─────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────
// Recalculate remainingAmount before saving
monthlyRentRecordSchema.pre('save', function() {
  // Ensure remaining is correct
  this.remainingAmount = Math.max(0, this.totalRent - this.totalPaid);
  
  // Auto-calculate status based on amounts
  if (this.totalPaid > this.totalRent) {
    this.status = 'overpaid';
    if (!this.paidOnDate) {
      this.paidOnDate = new Date();
    }
  } else if (this.remainingAmount === 0) {
    this.status = 'paid';
    if (!this.paidOnDate) {
      this.paidOnDate = new Date();
    }
  } else if (this.totalPaid > 0) {
    this.status = 'partial';
  } else {
    // If totalPaid is 0, check if it is overdue vs pending based on due date
    const today = new Date();
    if (this.dueDate && new Date(this.dueDate) < today) {
      this.status = 'overdue';
    } else {
      this.status = 'pending';
    }
  }
});

module.exports = mongoose.model('MonthlyRentRecord', monthlyRentRecordSchema);
