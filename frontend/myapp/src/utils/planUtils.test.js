import { normalizePlanKey, isPremiumPlan, getPlanBadgeLabel } from './planUtils';

describe('plan utilities', () => {
  it('normalizes lowercase premium values and identifies them as premium', () => {
    expect(normalizePlanKey('lifetime')).toBe('LIFETIME');
    expect(normalizePlanKey('monthly')).toBe('MONTHLY');
    expect(isPremiumPlan('annual')).toBe(true);
    expect(isPremiumPlan('free')).toBe(false);
  });

  it('returns a proper premium label for active premium plans', () => {
    expect(getPlanBadgeLabel('lifetime')).toBe('Premium · Lifetime');
    expect(getPlanBadgeLabel('annual')).toBe('Premium · Annual');
    expect(getPlanBadgeLabel('free')).toBe('Free');
  });
});
