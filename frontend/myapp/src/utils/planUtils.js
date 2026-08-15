const PREMIUM_PLAN_KEYS = ['FREE', 'MONTHLY', 'ANNUAL', 'LIFETIME'];

export function normalizePlanKey(plan) {
  const value = String(plan ?? 'FREE').trim();
  if (!value) return 'FREE';

  const normalized = value.toUpperCase();
  if (PREMIUM_PLAN_KEYS.includes(normalized)) return normalized;

  if (normalized === 'PREMIUM' || normalized.includes('LIFETIME') || normalized.includes('LIFE')) return 'LIFETIME';
  if (normalized.includes('MONTH')) return 'MONTHLY';
  if (normalized.includes('ANNUAL') || normalized.includes('YEAR')) return 'ANNUAL';
  if (normalized === 'FREE' || normalized === 'BASIC' || normalized === 'STANDARD') return 'FREE';

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
