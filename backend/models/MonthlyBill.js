'use strict';

const mongoose = require('mongoose');

/**
 * BillItem subdocument
 * Each line item on the monthly invoice.
 */
const billItemSchema = new mongoose.Schema(
  {
    type: {
      type   : String,
      enum   : ['RENT', 'ELECTRICITY', 'WATER', 'MAINTENANCE', 'INTERNET', 'GAS', 'PARKING', 'CLEANING', 'SOCIETY', 'GARBAGE', 'LATE_FEE', 'OTHER'],
      required: [true, 'Item type is required'],
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
    // For electricity: stores meter readings and rate
    metadata: {
      type   : mongoose.Schema.Types.Mixed,
      default: null,
      // Example for ELECTRICITY:
      // { previousReading: 12450, currentReading: 12625, unitsConsumed: 175, ratePerUnit: 7 }
    },
    // Waiver for this specific line item
    isWaived: {
      type   : Boolean,
      default: false,
    },
    waivedAmount: {
      type   : Number,
      default: 0,
      min    : [0, 'Waived amount cannot be negative'],
    },
    waiverReason: {
      type     : String,
      trim     : true,
      maxlength: [300, 'Waiver reason cannot exceed 300 characters'],
      default  : null,
    },
    waivedAt: {
      type   : Date,
      default: null,
    },
    // Net amount after waiver
    effectiveAmount: {
      type   : Number,
      min    : [0, 'Effective amount cannot be negative'],
      default: function () { return this.amount; },
    },
  },
  { _id: true }
);

/**
 * MonthlyBill
 * ─────────────────────────────────────────────────────────────────────────────
 * The invoice layer. One bill per tenant per month.
 * Links to MonthlyRentRecord (the payment/ledger side) via rentRecordId.
 *
 * Flow:
 *   MonthlyBill (invoice) ──► MonthlyRentRecord (ledger) ──► PaymentTransaction
 *
 * When a bill item is waived, the bill's totalAmount is recalculated and
 * synced to MonthlyRentRecord.totalRent so the payment side stays consistent.
 */
const monthlyBillSchema = new mongoose.Schema(
  {
    tenantId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    userId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'User',
      required: [true, 'User reference is required'],
    },
    roomId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Room',
      required: [true, 'Room reference is required'],
    },
    propertyId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Property',
      required: [true, 'Property reference is required'],
    },
    ownerId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'User',
      required: [true, 'Owner reference is required'],
    },
    // Links to the payment/ledger record — created when bill is finalized
    rentRecordId: {
      type   : mongoose.Schema.Types.ObjectId,
      ref    : 'MonthlyRentRecord',
      default: null,
    },
    // "YYYY-MM" e.g. "2026-10"
    month: {
      type    : String,
      required: [true, 'Month is required'],
      match   : [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'],
    },
    dueDate: {
      type    : Date,
      required: [true, 'Due date is required'],
    },
    // Line items
    items: {
      type    : [billItemSchema],
      default : [],
    },
    // Totals (auto-calculated in pre-save)
    subtotal: {
      type   : Number,
      default: 0,
      min    : [0, 'Subtotal cannot be negative'],
    },
    discount: {
      type   : Number,
      default: 0,
      min    : [0, 'Discount cannot be negative'],
    },
    totalAmount: {
      type   : Number,
      default: 0,
      min    : [0, 'Total amount cannot be negative'],
    },
    // Bill lifecycle
    status: {
      type   : String,
      enum   : ['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED'],
      default: 'DRAFT',
    },
    // Whether the bill has been sent/published to the tenant
    isPublished: {
      type   : Boolean,
      default: false,
    },
    publishedAt: {
      type   : Date,
      default: null,
    },
    notes: {
      type     : String,
      trim     : true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default  : null,
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

// One bill per tenant per month
monthlyBillSchema.index({ tenantId: 1, month: 1 }, { unique: true });
monthlyBillSchema.index({ ownerId: 1, month: 1 });
monthlyBillSchema.index({ propertyId: 1, month: 1 });
monthlyBillSchema.index({ status: 1 });
monthlyBillSchema.index({ rentRecordId: 1 });

// Auto-recalculate totals before every save
monthlyBillSchema.pre('save', function () {
  let subtotal = 0;
  for (const item of this.items) {
    // Effective amount = original amount minus any item-level waiver
    item.effectiveAmount = Math.max(0, item.amount - (item.waivedAmount || 0));
    if (item.isWaived) item.effectiveAmount = 0;
    subtotal += item.effectiveAmount;
  }
  this.subtotal = subtotal;
  this.totalAmount = Math.max(0, subtotal - (this.discount || 0));
});

module.exports = mongoose.model('MonthlyBill', monthlyBillSchema);
