const PREMIUM_PLAN_KEYS = ['FREE', 'MONTHLY', 'ANNUAL', 'LIFETIME'];

export function normalizePlanKey(plan) {
  const value = String(plan ?? 'FREE').trim();
  if (!value) return 'FREE';
  const normalized = value.toUpperCase();
  if (PREMIUM_PLAN_KEYS.includes(normalized)) return normalized;
  return 'FREE';
}

export function isPremiumPlan(plan) {
  const normalized = normalizePlanKey(plan);
  return ['MONTHLY', 'ANNUAL', 'LIFETIME'].includes(normalized);
}

export function getPlanBadgeLabel(plan) {
  const normalized = normalizePlanKey(plan);

  if (normalized === 'LIFETIME') return 'Premium · Lifetime';
  if (normalized === 'MONTHLY') return 'Premium · Monthly';
  if (normalized === 'ANNUAL') return 'Premium · Annual';
  return 'Free';
}
