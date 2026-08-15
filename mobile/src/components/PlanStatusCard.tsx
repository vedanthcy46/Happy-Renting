import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { getAiEntitlement } from '../api/ai';
import { getMySubscription } from '../api/subscription';
import { Workspace } from '../types/ai';

interface PlanStatusCardProps {
  workspace: Workspace;
}

const PREMIUM_PLANS = ['MONTHLY', 'ANNUAL', 'LIFETIME'];

const PLAN_LABEL_KEYS: Record<string, string> = {
  MONTHLY: 'subscription.monthly',
  ANNUAL: 'subscription.annual',
  LIFETIME: 'subscription.lifetime',
};

export const PlanStatusCard: React.FC<PlanStatusCardProps> = ({ workspace }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['planStatus', workspace],
    queryFn: async () => {
      const entitlementRes = await getAiEntitlement(workspace);
      const plan = entitlementRes?.entitlement?.plan || 'FREE';
      let expiresAt: string | null = null;
      if (workspace === 'owner') {
        try {
          const subRes = await getMySubscription();
          expiresAt = subRes?.subscription?.expiresAt || null;
        } catch {
          expiresAt = null;
        }
      }
      return { plan, expiresAt };
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  if (isLoading || isError || !data) return null;

  const isPremium = PREMIUM_PLANS.includes(data.plan);
  const labelKey = PLAN_LABEL_KEYS[data.plan];

  const onPress = () => {
    if (workspace === 'owner') router.navigate('/subscription' as any);
  };

  if (isPremium) {
    return (
      <LinearGradient colors={colors.gradient.premium as any} style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="diamond-outline" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('subscription.premium')}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('subscription.currentPlan')}</Text>
            </View>
          </View>
          <Text style={styles.message}>
            {labelKey ? t(labelKey) : ''}
            {workspace === 'tenant' ? ` · ${t('subscription.managedByOwner')}` : ''}
            {data.expiresAt && data.plan !== 'LIFETIME'
              ? ` · ${t('subscription.expiresOn', { date: new Date(data.expiresAt).toLocaleDateString() })}`
              : ''}
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={workspace === 'owner' ? 0.8 : 1}
      style={[styles.card, { backgroundColor: colors.surface }, styles.shadow]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.borderLight }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.text.secondary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('subscription.currentFree')}</Text>
        <Text style={[styles.message, { color: colors.text.secondary }]}>
          {workspace === 'owner' ? t('subscription.freeOwnerSub') : t('subscription.freeTenantSub')}
        </Text>
      </View>
      {workspace === 'owner' && (
        <View style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.upgradeBtnText}>{t('subscription.buy')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  message: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.95,
  },
  upgradeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
