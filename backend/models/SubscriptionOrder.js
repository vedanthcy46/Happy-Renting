'use strict';

const mongoose = require('mongoose');

/**
 * SubscriptionOrder
 * ------------------------------------------------------------------
 * Tracks a Cashfree checkout for a premium subscription purchase.
 * Created when an owner taps "Buy" — the webhook (or status poll) marks
 * it paid and the owner's embedded subscription is activated.
 */

const subscriptionOrderSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Plan being purchased: MONTHLY | ANNUAL | LIFETIME
    plan: {
      type: String,
      enum: ['MONTHLY', 'ANNUAL', 'LIFETIME'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be positive'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    // Cashfree order id (cf_...) — used to correlate webhook + status poll.
    cashfreeOrderId: {
      type: String,
      default: '',
      index: true,
    },
    cashfreePaymentId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'voided', 'reversed'],
      default: 'pending',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    // Admin reversal tracking (reverse / undo reversal)
    reversedAt: {
      type: Date,
      default: null,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reversalReason: {
      type: String,
      default: '',
    },
    // Computed when activated (monthly +1 month, annual +1 year, lifetime null).
    activatedUntil: {
      type: Date,
      default: null,
    },
    activationError: {
      type: String,
      default: '',
    },
    paymentUrl: {
      type: String,
      default: '',
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

subscriptionOrderSchema.index({ ownerId: 1, status: 1 });
subscriptionOrderSchema.index({ cashfreeOrderId: 1, status: 1 });

module.exports = mongoose.model('SubscriptionOrder', subscriptionOrderSchema);
