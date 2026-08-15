'use strict';

const mongoose = require('mongoose');

/**
 * Embedded subscription record on a User.
 *
 * Only OWNERS carry a real subscription. Tenants inherit entitlement from the
 * owner they are currently associated with and do NOT need their own record.
 *
 * Free is the default; a LIFETIME (Premium) purchase upgrades the owner and
 * cascades to that owner's tenants automatically.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    plan: {
      type: String,
      enum: ['FREE', 'LIFETIME', 'MONTHLY', 'ANNUAL'],
      default: 'FREE',
      required: true,
    },
    // Billing period for paid plans: 'monthly' | 'annual' | 'lifetime'.
    // FREE plans leave this null.
    billingPeriod: {
      type: String,
      enum: ['monthly', 'annual', 'lifetime', null],
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'pending'],
      default: 'active',
    },
    purchasedAt: {
      type: Date,
      default: null,
    },
    // When a paid (monthly/annual) plan expires. null for FREE and LIFETIME.
    expiresAt: {
      type: Date,
      default: null,
    },
    lifetime: {
      type: Boolean,
      default: false,
    },
    // Bump when plan definitions change so clients can re-fetch entitlements.
    entitlementVersion: {
      type: Number,
      default: 1,
    },
  },
  { _id: false }
);

module.exports = subscriptionSchema;