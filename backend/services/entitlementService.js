'use strict';

/**
 * entitlementService
 * ------------------------------------------------------------------
 * Central place that resolves what a user is entitled to based on plans.
 *
 * Rule (the critical one):
 *   - OWNERS have their own subscription (default FREE).
 *   - TENANTS inherit the plan of the OWNER they are currently associated
 *     with. They never purchase independently. When an owner upgrades, all
 *     their tenants automatically get the same AI entitlement.
 *   - If a tenant moves to another owner, the next request resolves the new
 *     owner's plan — there is no permanent plan stored on the tenant.
 *
 * All enforcement must happen server-side (this service) — never only in the
 * client UI, so the limit cannot be bypassed by calling the API directly.
 */

const User   = require('../models/User');
const Tenant = require('../models/Tenant');
const AIUsage = require('../models/AIUsage');
const { getPlan, isUnlimited, currentMonthKey } = require('../config/plans');

const logger = require('../config/logger');

/* ---------- plan resolution ---------- */

/**
 * Resolve the plan KEY (e.g. 'FREE', 'LIFETIME') for an owner user.
 * Tenants are NOT resolved here — use resolvePlanForUser.
 *
 * Monthly/annual plans expire: if expiresAt has passed, the owner resolves
 * back to FREE until they renew.
 */
function planKeyForOwner(user) {
  if (!user || !user.subscription || !user.subscription.plan) return 'FREE';
  const key = String(user.subscription.plan).toUpperCase();
  if (key !== 'FREE' && key !== 'LIFETIME' && key !== 'MONTHLY' && key !== 'ANNUAL') return 'FREE';
  if (key === 'LIFETIME') return 'LIFETIME';
  if (user.subscription.status !== 'active') return 'FREE';

  // MONTHLY / ANNUAL: still active only if not yet expired.
  const expiresAt = user.subscription.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() > Date.now()) return key;
  return 'FREE';
}

/**
 * Find the current owner for a tenant user.
 * Returns { ownerId } or null if the tenant has no active tenancy.
 */
async function findOwnerForTenant(userId) {
  const tenant = await Tenant.findOne({ userId: userId, status: 'active' })
    .select('ownerId propertyId')
    .sort({ createdAt: -1 })
    .lean();
  if (!tenant) return null;
  return { ownerId: tenant.ownerId, tenantId: tenant._id, propertyId: tenant.propertyId };
}

/**
 * Resolve the effective plan for ANY user in the given workspace.
 *
 * @param {object} user authenticated user (mongoose doc or lean)
 * @param {'owner'|'tenant'} workspace
 * @returns {Promise<{
 *   plan: string,
 *   ownerId: string|null,
 *   isTenant: boolean,
 *   controlledByOwner: boolean,
 *   tenantId?: string,
 *   propertyId?: string
 * }>}
 */
async function resolvePlanForUser(user, workspace) {
  if (workspace === 'owner') {
    return {
      plan: planKeyForOwner(user),
      ownerId: String(user._id),
      isTenant: false,
      controlledByOwner: false,
    };
  }

  // Tenant workspace: resolve via current owner.
  const rel = await findOwnerForTenant(user._id);
  if (!rel) {
    // No active tenancy — treat as free (no entitlement, no allowance).
    return { plan: 'FREE', ownerId: null, isTenant: true, controlledByOwner: true, tenantId: null, propertyId: null };
  }

  let ownerPlan = 'FREE';
  try {
    const owner = await User.findById(rel.ownerId).select('subscription').lean();
    if (owner) ownerPlan = planKeyForOwner(owner);
  } catch (e) {
    logger.error('[Entitlement] Failed to load owner for tenant ' + user._id + ': ' + e.message);
  }

  return {
    plan: ownerPlan,
    ownerId: String(rel.ownerId),
    isTenant: true,
    controlledByOwner: true,
    tenantId: String(rel.tenantId),
    propertyId: rel.propertyId ? String(rel.propertyId) : null,
  };
}

/* ---------- AI entitlement ---------- */

/**
 * Compute AI entitlement for a user in a workspace.
 * Returns used/limit/remaining for the current calendar month.
 */
async function getAIEntitlement(user, workspace) {
  const resolved = await resolvePlanForUser(user, workspace);
  const plan = getPlan(resolved.plan);
  const month = currentMonthKey();
  const limit = workspace === 'owner' ? plan.ownerAI : plan.tenantAI;

  // Premium: unlimited under fair use — remaining is null to signal "no cap".
  if (isUnlimited(limit)) {
    return {
      plan: resolved.plan,
      workspace,
      ownerId: resolved.ownerId,
      isTenant: resolved.isTenant,
      controlledByOwner: resolved.controlledByOwner,
      tenantId: resolved.tenantId || null,
      propertyId: resolved.propertyId || null,
      limit,
      used: null,
      remaining: null,
      isUnlimited: true,
      month,
    };
  }

  const usage = await AIUsage.findOne({ userId: user._id, workspace, month }).lean();
  const used = usage ? usage.promptCount : 0;
  return {
    plan: resolved.plan,
    workspace,
    ownerId: resolved.ownerId,
    isTenant: resolved.isTenant,
    controlledByOwner: resolved.controlledByOwner,
    tenantId: resolved.tenantId || null,
    propertyId: resolved.propertyId || null,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    isUnlimited: false,
    month,
  };
}

/**
 * Check whether a user may send an AI prompt right now.
 * @returns {{ok: boolean, entitlement: object, error?: string}}
 */
async function canUseAI(user, workspace) {
  const entitlement = await getAIEntitlement(user, workspace);
  if (entitlement.isUnlimited) return { ok: true, entitlement };
  if (entitlement.remaining > 0) return { ok: true, entitlement };
  return {
    ok: false,
    entitlement,
    error: 'Free AI limit reached for this month.',
  };
}

/**
 * Atomically consume one AI prompt for the user/workspace/month.
 * Returns the updated count. Never exceeds the free limit.
 */
async function recordAIUsage(user, workspace, opts = {}) {
  const resolved = await resolvePlanForUser(user, workspace);
  const plan = getPlan(resolved.plan);
  const month = opts.month || currentMonthKey();
  const limit = workspace === 'owner' ? plan.ownerAI : plan.tenantAI;

  const ownerId = resolved.ownerId || null;
  const tenantId = resolved.tenantId || null;
  const propertyId = resolved.propertyId || null;

  if (isUnlimited(limit)) {
    // Premium: still record usage for auditing, but never block.
    try {
      const doc = await AIUsage.findOneAndUpdate(
        { userId: user._id, workspace, month },
        { $inc: { promptCount: 1 }, $set: { lastPromptAt: new Date(), ownerId, tenantId, propertyId } },
        { upsert: true, new: true }
      ).lean();
      return doc.promptCount;
    } catch (e) {
      logger.error('[Entitlement] recordAIUsage (premium) failed: ' + e.message);
      return null;
    }
  }

  // Free: guard against overshoot via a conditional increment.
  const guarded = await AIUsage.findOneAndUpdate(
    { userId: user._id, workspace, month, promptCount: { $lt: limit } },
    { $inc: { promptCount: 1 }, $set: { lastPromptAt: new Date(), ownerId, tenantId, propertyId } },
    { new: true }
  ).lean();
  if (guarded) return guarded.promptCount;

  // Either the doc exists at the limit (caller should have blocked) or no doc
  // exists yet. Try to create/seed it atomically (handles first use + race).
  try {
    const seeded = await AIUsage.findOneAndUpdate(
      { userId: user._id, workspace, month },
      {
        $setOnInsert: { promptCount: 0, ownerId, tenantId, propertyId },
        $set: { lastPromptAt: new Date() },
      },
      { upsert: true, new: true }
    ).lean();
    if (seeded.promptCount >= limit) return seeded.promptCount;

    const incremented = await AIUsage.findOneAndUpdate(
      { userId: user._id, workspace, month, promptCount: { $lt: limit } },
      { $inc: { promptCount: 1 }, $set: { lastPromptAt: new Date() } },
      { new: true }
    ).lean();
    return incremented ? incremented.promptCount : limit;
  } catch (e) {
    // Duplicate key on a concurrent first-insert: fall back to a guarded inc.
    logger.warn('[Entitlement] recordAIUsage race, retrying inc: ' + e.message);
    const retried = await AIUsage.findOneAndUpdate(
      { userId: user._id, workspace, month, promptCount: { $lt: limit } },
      { $inc: { promptCount: 1 }, $set: { lastPromptAt: new Date() } },
      { new: true }
    ).lean();
    return retried ? retried.promptCount : limit;
  }
}

/* ---------- resource limits (properties / rooms / active tenants) ---------- */

/**
 * Count current usage for an owner's countable resources.
 */
async function getOwnerUsageCounts(ownerId) {
  const [Property, Room, Tenant] = await Promise.all([
    Promise.resolve(require('../models/Property')),
    Promise.resolve(require('../models/Room')),
    Promise.resolve(require('../models/Tenant')),
  ]);

  const [propertyCount, roomCount, activeTenantCount] = await Promise.all([
    Property.countDocuments({ ownerId, isActive: true }),
    Room.countDocuments({ ownerId, isActive: true }),
    Tenant.countDocuments({ ownerId, status: 'active' }),
  ]);

  return {
    properties: { used: propertyCount },
    rooms: { used: roomCount },
    activeTenants: { used: activeTenantCount },
  };
}

/**
 * Server-side creation guard for an owner's countable resources.
 * Used by the create controllers (properties / rooms / tenants) so the plan
 * limits cannot be bypassed from the web or the app.
 *
 * @param {object} user authenticated owner user
 * @param {'properties'|'rooms'|'activeTenants'} kind
 * @returns {Promise<{ok: boolean, used: number, limit: number, plan: string, message?: string}>}
 */
async function getCreationGuard(user, kind) {
  const resolved = await resolvePlanForUser(user, 'owner');
  const plan = getPlan(resolved.plan);
  const counts = await getOwnerUsageCounts(resolved.ownerId);

  const map = {
    properties: { used: counts.properties.used, limit: plan.properties },
    rooms: { used: counts.rooms.used, limit: plan.rooms },
    activeTenants: { used: counts.activeTenants.used, limit: plan.activeTenants },
  };
  const entry = map[kind];
  if (!entry) throw new Error(`Unknown resource kind: ${kind}`);

  if (isUnlimited(entry.limit)) {
    return { ok: true, used: entry.used, limit: entry.limit, plan: resolved.plan };
  }

  const ok = entry.used < entry.limit;
  return {
    ok,
    used: entry.used,
    limit: entry.limit,
    plan: resolved.plan,
    message: ok
      ? undefined
      : `You've reached the Free plan limit of ${entry.limit} ${kind.replace(/([A-Z])/g, ' $1').toLowerCase()}. Upgrade to Premium from the Happy Renting app to add more.`,
  };
}

/**
 * Full entitlement snapshot used by GET /api/ai/entitlement (and later for the
 * subscription screen). Includes AI plus the countable resource limits.
 */
async function getFullEntitlements(user, workspace) {
  const resolved = await resolvePlanForUser(user, workspace);
  const plan = getPlan(resolved.plan);
  const month = currentMonthKey();
  const aiLimit = workspace === 'owner' ? plan.ownerAI : plan.tenantAI;

  let usage = null;
  if (resolved.ownerId && !resolved.isTenant) {
    usage = await getOwnerUsageCounts(resolved.ownerId);
  } else if (resolved.ownerId && resolved.isTenant) {
    // For tenants we only surface AI + basic counts (their own).
    usage = { properties: null, rooms: null, activeTenants: null };
  }

  const aiUsage = await AIUsage.findOne({ userId: user._id, workspace, month }).lean();

  const ai = {
    plan: resolved.plan,
    limit: aiLimit,
    used: isUnlimited(aiLimit) ? null : (aiUsage ? aiUsage.promptCount : 0),
    remaining: isUnlimited(aiLimit) ? null : Math.max(0, aiLimit - (aiUsage ? aiUsage.promptCount : 0)),
    isUnlimited: isUnlimited(aiLimit),
  };

  const limitVal = (n) => (isUnlimited(n) ? -1 : n);

  return {
    plan: resolved.plan,
    ownerId: resolved.ownerId,
    isTenant: resolved.isTenant,
    controlledByOwner: resolved.controlledByOwner,
    tenantId: resolved.tenantId || null,
    month,
    entitlements: {
      properties: { used: usage && usage.properties ? usage.properties.used : null, limit: limitVal(plan.properties) },
      rooms: { used: usage && usage.rooms ? usage.rooms.used : null, limit: limitVal(plan.rooms) },
      activeTenants: { used: usage && usage.activeTenants ? usage.activeTenants.used : null, limit: limitVal(plan.activeTenants) },
      ownerAI: workspace === 'owner' ? ai : null,
      tenantAI: workspace === 'tenant' ? ai : null,
      reportMonths: { limit: limitVal(plan.reportMonths) },
      advancedReports: plan.advancedReports,
      exportPdf: plan.exportPdf,
      exportExcel: plan.exportExcel,
      multipleProperties: plan.multipleProperties,
    },
  };
}

module.exports = {
  planKeyForOwner,
  resolvePlanForUser,
  getAIEntitlement,
  canUseAI,
  recordAIUsage,
  getFullEntitlements,
  getOwnerUsageCounts,
  getCreationGuard,
};