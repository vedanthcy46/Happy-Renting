process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Stub the mongoose models before requiring the service ──────────────────
const stubUser = {
  planKeyForOwner: null,
  expiresAt: null,
  subscriptionStatus: 'active',
  findById: async () => stubUser.planKeyForOwner,
};
const stubTenant = { rel: null };
const stubAIUsage = { existing: null };

const chainable = (resolver) => {
  const chain = {
    select() { return chain; },
    sort() { return chain; },
    lean: async () => resolver(),
  };
  return chain;
};

const modelStubs = {
  '../models/User': {
    findById: () => chainable(() => ({
      subscription: { plan: stubUser.planKeyForOwner, status: stubUser.subscriptionStatus, expiresAt: stubUser.expiresAt },
    })),
  },
  '../models/Tenant': {
    findOne: () => chainable(() => stubTenant.rel),
  },
  '../models/AIUsage': {
    findOne: () => chainable(() => {
      if (stubAIUsage.existing) return { promptCount: stubAIUsage.existing.count };
      return null;
    }),
    findOneAndUpdate: async () => ({ promptCount: 1 }),
  },
};

const Module = require('node:module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (modelStubs[request]) return request;
  return origResolve.call(this, request, ...args);
};
const origLoad = Module._load;
Module._load = function (request, ...args) {
  if (modelStubs[request]) return modelStubs[request];
  return origLoad.call(this, request, ...args);
};

const entitlementService = require('../services/entitlementService');
const plans = require('../config/plans');

const ownerUser = { _id: 'own000000000000000000001', subscription: { plan: 'FREE', status: 'active' } };
const premiumOwner = { _id: 'own000000000000000000002', subscription: { plan: 'LIFETIME', status: 'active' } };
const tenantUser = { _id: 'ten000000000000000000001' };

function resetStubs() {
  stubUser.planKeyForOwner = null;
  stubUser.expiresAt = null;
  stubUser.subscriptionStatus = 'active';
  stubTenant.rel = null;
  stubAIUsage.existing = null;
}

test('owner on FREE plan gets 2 prompts, remaining counts down', async () => {
  resetStubs();
  stubUser.planKeyForOwner = 'FREE';
  stubAIUsage.existing = { month: plans.currentMonthKey(), count: 1 };

  const ent = await entitlementService.getAIEntitlement(ownerUser, 'owner');
  assert.equal(ent.plan, 'FREE');
  assert.equal(ent.limit, 2);
  assert.equal(ent.used, 1);
  assert.equal(ent.remaining, 1);
  assert.equal(ent.isTenant, false);
});

test('owner on LIFETIME plan is unlimited', async () => {
  resetStubs();
  stubUser.planKeyForOwner = 'LIFETIME';
  const ent = await entitlementService.getAIEntitlement(premiumOwner, 'owner');
  assert.equal(ent.plan, 'LIFETIME');
  assert.equal(ent.isUnlimited, true);
  assert.equal(ent.remaining, null);
});

test('canUseAI blocks when free allowance exhausted', async () => {
  resetStubs();
  stubUser.planKeyForOwner = 'FREE';
  stubAIUsage.existing = { month: plans.currentMonthKey(), count: 2 };
  const gate = await entitlementService.canUseAI(ownerUser, 'owner');
  assert.equal(gate.ok, false);
  assert.equal(gate.entitlement.remaining, 0);
});

test('tenant inherits the plan of their current owner', async () => {
  resetStubs();
  stubTenant.rel = {
    ownerId: 'own000000000000000000002',
    _id: 'ten000000000000000000099',
    propertyId: 'prop000000000000000000001',
  };
  stubUser.planKeyForOwner = 'LIFETIME'; // the owner is premium
  const ent = await entitlementService.getAIEntitlement(tenantUser, 'tenant');
  assert.equal(ent.plan, 'LIFETIME');
  assert.equal(ent.isTenant, true);
  assert.equal(ent.controlledByOwner, true);
  assert.equal(ent.isUnlimited, true);
});

test('tenant under FREE owner gets 2 prompts per tenant', async () => {
  resetStubs();
  stubTenant.rel = {
    ownerId: 'own000000000000000000001',
    _id: 'ten000000000000000000099',
    propertyId: 'prop000000000000000000001',
  };
  stubUser.planKeyForOwner = 'FREE';
  stubAIUsage.existing = { month: plans.currentMonthKey(), count: 1 };
  const ent = await entitlementService.getAIEntitlement(tenantUser, 'tenant');
  assert.equal(ent.plan, 'FREE');
  assert.equal(ent.limit, 2);
  assert.equal(ent.remaining, 1);
  assert.equal(ent.ownerId, 'own000000000000000000001');
});

test('resolvePlanForUser with no active tenancy returns FREE', async () => {
  resetStubs();
  stubTenant.rel = null;
  const resolved = await entitlementService.resolvePlanForUser(tenantUser, 'tenant');
  assert.equal(resolved.plan, 'FREE');
  assert.equal(resolved.ownerId, null);
});

test('MONTHLY plan is active until expiry, then resolves to FREE', async () => {
  resetStubs();
  const monthlyOwner = {
    _id: 'own000000000000000000001',
    subscription: { plan: 'MONTHLY', status: 'active', expiresAt: new Date(Date.now() + 20 * 24 * 3600 * 1000) },
  };
  const active = await entitlementService.getAIEntitlement(monthlyOwner, 'owner');
  assert.equal(active.plan, 'MONTHLY');
  assert.equal(active.isUnlimited, true);

  resetStubs();
  const expiredOwner = {
    _id: 'own000000000000000000001',
    subscription: { plan: 'MONTHLY', status: 'active', expiresAt: new Date(Date.now() - 1000) },
  };
  const expired = await entitlementService.getAIEntitlement(expiredOwner, 'owner');
  assert.equal(expired.plan, 'FREE');
  assert.equal(expired.limit, 2);
});

test('ANNUAL plan works like MONTHLY (expires back to FREE)', async () => {
  resetStubs();
  const annualOwner = {
    _id: 'own000000000000000000001',
    subscription: { plan: 'ANNUAL', status: 'active', expiresAt: new Date(Date.now() + 200 * 24 * 3600 * 1000) },
  };
  const active = await entitlementService.getAIEntitlement(annualOwner, 'owner');
  assert.equal(active.plan, 'ANNUAL');
  assert.equal(active.isUnlimited, true);

  resetStubs();
  const noExpiryOwner = {
    _id: 'own000000000000000000001',
    subscription: { plan: 'ANNUAL', status: 'active', expiresAt: null },
  };
  const expired = await entitlementService.getAIEntitlement(noExpiryOwner, 'owner');
  assert.equal(expired.plan, 'FREE');
});

test('tenant inherits a paid MONTHLY owner plan', async () => {
  resetStubs();
  stubTenant.rel = {
    ownerId: 'own000000000000000000002',
    _id: 'ten000000000000000000099',
    propertyId: 'prop000000000000000000001',
  };
  stubUser.planKeyForOwner = 'MONTHLY';
  stubUser.expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const ent = await entitlementService.getAIEntitlement(tenantUser, 'tenant');
  assert.equal(ent.plan, 'MONTHLY');
  assert.equal(ent.isTenant, true);
  assert.equal(ent.isUnlimited, true);
});

Module._resolveFilename = origResolve;
Module._load = origLoad;