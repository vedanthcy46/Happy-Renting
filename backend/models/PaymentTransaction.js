'use strict';

const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema(
  {
    // Reference to the monthly rent record
    rentRecordId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'MonthlyRentRecord',
      required : [true, 'Rent record reference is required'],
    },
    // For quick lookups and filtering
    tenantId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Tenant',
      required : [true, 'Tenant reference is required'],
    },
    ownerId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'Owner reference is required'],
    },
    propertyId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Property',
      required : [true, 'Property reference is required'],
    },
    
    // ─────────────────────────────────────────────────────────────────────
    // PAYMENT DETAILS
    // ─────────────────────────────────────────────────────────────────────
    // How much was paid in this transaction?
    amount: {
      type    : Number,
      required: [true, 'Amount is required'],
      min     : [0.01, 'Amount must be greater than 0'],
    },
    // How was this payment made?
    paymentMethod: {
      type    : String,
      enum    : ['cash', 'upi', 'bank_transfer', 'cheque', 'other'],
      default : 'cash',
      required: true,
    },
    // Reference ID for tracking (e.g., UPI ref, bank transfer ID, cheque number)
    transactionId: {
      type : String,
      trim : true,
      default: null,
    },
    // URL of payment proof (screenshot, receipt, etc.)
    proofImage: {
      secureUrl: { type: String, default: null },
      publicId : { type: String, default: null },
    },
    
    // ─────────────────────────────────────────────────────────────────────
    // METADATA
    // ─────────────────────────────────────────────────────────────────────
    // Who recorded this payment? (owner or superadmin)
    recordedBy: {
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'User',
      required: true,
    },
    // When was this payment made? (may differ from created timestamp)
    paymentDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    // Any notes about this transaction
    note: {
      type     : String,
      trim     : true,
      maxlength: [300, 'Note cannot exceed 300 characters'],
    },
    
    // ─────────────────────────────────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────────────────────────────────
    // For future: allows marking a transaction as reversed or adjusted
    status: {
      type    : String,
      enum    : ['completed', 'reversed', 'failed'],
      default : 'completed',
    },
    // If reversed or failed, why?
    statusReason: {
      type: String,
      trim: true,
      maxlength: [300, 'Status reason cannot exceed 300 characters'],
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

// ─────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────
// Find all transactions for a rent record
paymentTransactionSchema.index({ rentRecordId: 1 });
// Find all transactions by tenant
paymentTransactionSchema.index({ tenantId: 1 });
// Find all transactions by owner
paymentTransactionSchema.index({ ownerId: 1 });
// Prevent duplicate transaction IDs for payment methods that use them
paymentTransactionSchema.index({ transactionId: 1, paymentMethod: 1 }, { sparse: true });
// Timeline queries
paymentTransactionSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
