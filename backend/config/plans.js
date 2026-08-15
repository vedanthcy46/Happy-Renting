'use strict';

/**
 * Subscription plan definitions.
 *
 * Plan resolution:
 *  - Owners have their own plan (default FREE).
 *  - Tenants inherit the plan of the OWNER they are currently associated
 *    with. A tenant never has an independent plan.
 *
 * Negative limits (-1) mean "expanded / unlimited under fair use".
 *
 * Bump these values here in one place; the entitlement service and the
 * mobile/web clients read them from here.
 */
const PLANS = {
  FREE: {
    key: 'FREE',
    name: 'Free',
    properties: 1,
    rooms: 3,
    activeTenants: 3,
    ownerAI: 2,       // prompts per calendar month
    tenantAI: 2,      // prompts per calendar month, per tenant
    reportMonths: 1,
    advancedReports: false,
    exportPdf: false,
    exportExcel: false,
    multipleProperties: false,
  },
  LIFETIME: {
    key: 'LIFETIME',
    name: 'Premium Lifetime',
    properties: -1,
    rooms: -1,
    activeTenants: -1,
    ownerAI: -1,
    tenantAI: -1,
    reportMonths: -1,
    advancedReports: true,
    exportPdf: true,
    exportExcel: true,
    multipleProperties: true,
  },
  // Monthly and Annual carry the same feature set as LIFETIME. The effective
  // plan is resolved by entitlementService which checks subscription expiry:
  // once expiresAt passes, these resolve back to FREE.
  MONTHLY: {
    key: 'MONTHLY',
    name: 'Premium Monthly',
    properties: -1,
    rooms: -1,
    activeTenants: -1,
    ownerAI: -1,
    tenantAI: -1,
    reportMonths: -1,
    advancedReports: true,
    exportPdf: true,
    exportExcel: true,
    multipleProperties: true,
  },
  ANNUAL: {
    key: 'ANNUAL',
    name: 'Premium Annual',
    properties: -1,
    rooms: -1,
    activeTenants: -1,
    ownerAI: -1,
    tenantAI: -1,
    reportMonths: -1,
    advancedReports: true,
    exportPdf: true,
    exportExcel: true,
    multipleProperties: true,
  },
};

const DEFAULT_PLAN = 'FREE';

/** @returns {string} 'YYYY-MM' key for the current month (used for AI usage). */
function currentMonthKey(date = new Date()) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

/**
 * Resolve the effective plan for a given plan key. Falls back to FREE for
 * unknown/empty values so a stale or missing subscription never unlocks more.
 * @param {string|null|undefined} planKey
 * @returns {{key: string, name: string, properties: number, rooms: number, activeTenants: number, ownerAI: number, tenantAI: number, reportMonths: number, advancedReports: boolean, exportPdf: boolean, exportExcel: boolean, multipleProperties: boolean}}
 */
function getPlan(planKey) {
  const plan = PLANS[String(planKey || '').toUpperCase()];
  if (!plan) return PLANS[DEFAULT_PLAN];
  return plan;
}

function isUnlimited(value) {
  return value === -1;
}

module.exports = { PLANS, DEFAULT_PLAN, getPlan, isUnlimited, currentMonthKey };