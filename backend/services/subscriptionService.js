'use strict';

/**
 * subscriptionService.js
 * ------------------------------------------------------------------
 * Pricing + activation for premium subscription purchases.
 *
 * Prices are admin-controlled via PlatformSettings:
 *   - monthlySubscription  (₹/month)
 *   - annualSubscription   (₹/year)
 *   - lifetimeSubscription  (₹ one-time)
 *
 * Purchase flow (one-time per period, no auto-renew):
 *   1. Owner requests an order -> controller reads price here, creates a
 *      Cashfree order, stores a SubscriptionOrder.
 *   2. Cashfree webhook (or the status poll) confirms payment.
 *   3. activateSubscription() upgrades the owner's embedded subscription
 *      and sets expiresAt for monthly/annual. LIFETIME never expires.
 */

const logger = require('../config/logger');

const PLAN_KEYS = ['MONTHLY', 'ANNUAL', 'LIFETIME'];

/**
 * Return admin-configured prices for the purchasable plans.
 * @returns {Promise<{monthly: number, annual: number, lifetime: number, enabled: boolean}>}
 */
async function getPurchasePrices() {
  const PlatformSettings = require('../models/PlatformSettings');
  const settings = await PlatformSettings.findOne({}).lean();
  const monthly = settings?.monthlySubscription ?? 299;
  const annual = settings?.annualSubscription ?? 2990;
  const lifetime = settings?.lifetimeSubscription ?? 4999;
  return {
    monthly,
    annual,
    lifetime,
    enabled: Boolean(settings?.subscriptionEnabled),
  };
}

/**
 * Resolve the price for a given plan key.
 * @param {'MONTHLY'|'ANNUAL'|'LIFETIME'} plan
 * @returns {Promise<number>}
 */
async function getPriceForPlan(plan) {
  const prices = await getPurchasePrices();
  const map = {
    MONTHLY: prices.monthly,
    ANNUAL: prices.annual,
    LIFETIME: prices.lifetime,
  };
  return map[plan] || 0;
}

/**
 * Compute the expiry date for a purchased plan (LIFETIME -> null).
 * @param {'MONTHLY'|'ANNUAL'|'LIFETIME'} plan
 */
function computeActivatedUntil(plan) {
  const now = new Date();
  if (plan === 'MONTHLY') {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (plan === 'ANNUAL') {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return null; // LIFETIME
}

/**
 * Activate (or renew) an owner's subscription after a confirmed payment.
 * Sets plan, billingPeriod, purchasedAt, expiresAt, lifetime, bumps
 * entitlementVersion so clients re-fetch their entitlements.
 *
 * @param {object} ownerId User ObjectId
 * @param {'MONTHLY'|'ANNUAL'|'LIFETIME'} plan
 * @returns {Promise<object>} activated subscription sub-document
 */
async function activateSubscription(ownerId, plan) {
  if (!PLAN_KEYS.includes(plan)) {
    throw new Error(`Unsupported subscription plan: ${plan}`);
  }

  const User = require('../models/User');
  const activatedUntil = computeActivatedUntil(plan);

  const update = {
    'subscription.plan': plan,
    'subscription.billingPeriod':
      plan === 'MONTHLY' ? 'monthly' : plan === 'ANNUAL' ? 'annual' : 'lifetime',
    'subscription.status': 'active',
    'subscription.purchasedAt': new Date(),
    'subscription.expiresAt': activatedUntil,
    'subscription.lifetime': plan === 'LIFETIME',
  };

  const user = await User.findByIdAndUpdate(
    ownerId,
    { $set: update, $inc: { 'subscription.entitlementVersion': 1 } },
    { new: true, runValidators: true }
  ).select('subscription');

  if (!user) {
    throw new Error('User not found while activating subscription');
  }

  logger.info(
    `[SUBSCRIPTION] Activated ${plan} for owner=${ownerId} until=${activatedUntil ? activatedUntil.toISOString() : 'LIFETIME'}`
  );

  return user.subscription;
}

/**
 * Reverse an owner's premium subscription (admin action).
 * Downgrades the owner back to FREE and bumps entitlementVersion so clients
 * immediately re-fetch their entitlements. Does NOT touch the SubscriptionOrder
 * record — the controller manages that.
 */
async function reverseSubscription(ownerId) {
  const User = require('../models/User');
  const user = await User.findByIdAndUpdate(
    ownerId,
    {
      $set: {
        'subscription.plan': 'FREE',
        'subscription.billingPeriod': null,
        'subscription.status': 'active',
        'subscription.purchasedAt': null,
        'subscription.expiresAt': null,
        'subscription.lifetime': false,
      },
      $inc: { 'subscription.entitlementVersion': 1 },
    },
    { new: true, runValidators: true }
  ).select('subscription');

  if (!user) throw new Error('User not found while reversing subscription');

  logger.info(`[SUBSCRIPTION] Reversed premium for owner=${ownerId}`);
  return user.subscription;
}

/**
 * Undo a reversal (admin action) — restore the owner to their paid plan with
 * the originally computed expiry. Idempotent; throws if the plan is invalid.
 */
async function undoSubscriptionReversal(ownerId, plan, activatedUntil) {
  if (!PLAN_KEYS.includes(plan)) {
    throw new Error(`Unsupported subscription plan: ${plan}`);
  }
  const User = require('../models/User');
  const user = await User.findByIdAndUpdate(
    ownerId,
    {
      $set: {
        'subscription.plan': plan,
        'subscription.billingPeriod':
          plan === 'MONTHLY' ? 'monthly' : plan === 'ANNUAL' ? 'annual' : 'lifetime',
        'subscription.status': 'active',
        'subscription.purchasedAt': new Date(),
        'subscription.expiresAt': activatedUntil || null,
        'subscription.lifetime': plan === 'LIFETIME',
      },
      $inc: { 'subscription.entitlementVersion': 1 },
    },
    { new: true, runValidators: true }
  ).select('subscription');

  if (!user) throw new Error('User not found while undoing subscription reversal');

  logger.info(`[SUBSCRIPTION] Undid reversal for owner=${ownerId} plan=${plan}`);
  return user.subscription;
}

module.exports = {
  PLAN_KEYS,
  getPurchasePrices,
  getPriceForPlan,
  computeActivatedUntil,
  activateSubscription,
  reverseSubscription,
  undoSubscriptionReversal,
};
