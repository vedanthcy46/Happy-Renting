'use strict';

const mongoose = require('mongoose');

/**
 * AI prompt usage tracking.
 *
 * One document per (user, workspace, month). A monthly allowance is
 * "2 prompts per calendar month" for both owner and each tenant on the Free
 * plan. The month key is 'YYYY-MM' so the counter resets naturally each month.
 *
 * Tenants are tracked per-user (each tenant gets their own allowance, not
 * shared across the property). The ownerId is stored for auditing and to make
 * it easy to find all AI usage under an owner.
 */
const aiUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // 'owner' | 'tenant'
    workspace: {
      type: String,
      enum: ['owner', 'tenant'],
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    // 'YYYY-MM' — the calendar month this allowance applies to.
    month: {
      type: String,
      required: true,
    },
    promptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPromptAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

aiUsageSchema.index({ userId: 1, workspace: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('AIUsage', aiUsageSchema);