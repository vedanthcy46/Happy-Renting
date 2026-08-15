import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius, shadows, typography } from '../theme';
import {
  getSubscriptionPlans,
  createSubscriptionOrder,
  getSubscriptionOrderStatus,
  getMySubscription,
} from '../api/subscription';
import { SubscriptionPlan } from '../types/subscription';

const PERIOD_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  MONTHLY: 'calendar-outline',
  ANNUAL: 'calendar-clear-outline',
  LIFETIME: 'infinite-outline',
};

const FEATURE_ICONS: React.ComponentProps<typeof Ionicons>['name'][] = [
  'chatbubble-ellipses-outline',
  'business-outline',
  'people-outline',
  'analytics-outline',
];

const PERIOD_SUFFIX_KEYS: Record<string, string> = {
  MONTHLY: 'subscription.perMonth',
  ANNUAL: 'subscription.perYear',
  LIFETIME: 'subscription.oneTime',
};

export const SubscriptionScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('FREE');
  const [currentExpiresAt, setCurrentExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // The deep link scheme that Cashfree will redirect back to after payment.
  // This MUST match the scheme in app.json.
  const APP_DEEP_LINK = 'happyrenting://subscription';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        getSubscriptionPlans().catch(() => ({ success: false, enabled: false, plans: [] as SubscriptionPlan[] })),
        getMySubscription().catch(() => null),
      ]);
      setEnabled(Boolean(plansRes?.enabled));
      setPlans(plansRes?.plans || []);
      if (subRes?.success && subRes.subscription) {
        setCurrentPlan(subRes.subscription.plan);
        setCurrentExpiresAt(subRes.subscription.expiresAt || null);
      }
    } catch {
      setEnabled(false);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isPremium =
    currentPlan === 'LIFETIME' || currentPlan === 'MONTHLY' || currentPlan === 'ANNUAL';

  const checkStatus = async (orderId: string) => {
    setCheckingStatus(true);
    try {
      const res = await getSubscriptionOrderStatus(orderId);
      if (res.status === 'success') {
        Alert.alert(t('subscription.successTitle'), t('subscription.successBody'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
        queryClient.invalidateQueries({ queryKey: ['planStatus'] });
        await load();
      } else if (res.status === 'pending') {
        Alert.alert(t('subscription.pendingTitle'), t('subscription.pendingBody'));
      } else {
        Alert.alert(t('subscription.failedTitle'), t('subscription.failedBody'));
      }
    } catch {
      Alert.alert(t('subscription.pendingTitle'), t('subscription.pendingBody'));
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleBuy = async (plan: SubscriptionPlan) => {
    if (!enabled) {
      Alert.alert(t('common.error'), t('subscription.disabled'));
      return;
    }
    setBuyingPlan(plan.key);
    try {
      const response = await createSubscriptionOrder(plan.key, APP_DEEP_LINK);
      if (response.success && response.paymentUrl) {
        // Set up deep link listener BEFORE opening browser.
        let subscription: any = null;

        const onDeepLink = ({ url }: { url: string }) => {
          if (url.startsWith('happyrenting://subscription')) {
            subscription?.remove();
            const urlObj = new URL(url);
            const returnedOrderId = urlObj.searchParams.get('order_id') || response.orderId;
            setBuyingPlan(null);
            checkStatus(returnedOrderId);
          }
        };

        subscription = Linking.addEventListener('url', onDeepLink);

        await Linking.openURL(response.paymentUrl);

        // Fallback dialog in case the deep link never fires.
        Alert.alert(
          t('subscription.paymentOpenedTitle'),
          t('subscription.paymentOpenedBody'),
          [
            {
              text: t('subscription.checkStatus'),
              onPress: () => {
                subscription?.remove();
                setBuyingPlan(null);
                checkStatus(response.orderId);
              },
            },
            {
              text: t('subscription.cancel'),
              style: 'cancel',
              onPress: () => {
                subscription?.remove();
                setBuyingPlan(null);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert(
        t('common.error'),
        error?.response?.data?.message || t('subscription.initiateFailed')
      );
      setBuyingPlan(null);
    }
  };

  const renderPlanCard = (plan: SubscriptionPlan, highlighted: boolean) => {
    const icon = PERIOD_ICONS[plan.key] || 'calendar-outline';
    return (
      <View
        key={plan.key}
        style={[
          styles.planCard,
          { backgroundColor: colors.surface, borderColor: highlighted ? colors.primary : colors.border },
          highlighted && { borderWidth: 2 },
          shadows.sm,
        ]}
      >
        {highlighted && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{t('subscription.mostPopular')}</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <View style={[styles.planIconBox, { backgroundColor: highlighted ? colors.primaryLight : colors.borderLight }]}>
            <Ionicons name={icon} size={22} color={highlighted ? colors.primary : colors.text.secondary} />
          </View>
          <Text style={[styles.planName, { color: colors.text.primary }]}>
            {t(`subscription.${plan.key === 'MONTHLY' ? 'monthly' : plan.key === 'ANNUAL' ? 'annual' : 'lifetime'}`)}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.text.primary }]}>₹{plan.price}</Text>
          <Text style={[styles.priceSuffix, { color: colors.text.secondary }]}>
            {t(PERIOD_SUFFIX_KEYS[plan.key])}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {FEATURE_ICONS.map((featureIcon, idx) => (
          <View key={idx} style={styles.featureRow}>
            <Ionicons
              name={featureIcon}
              size={15}
              color={colors.success}
            />
            <Text style={[styles.featureText, { color: colors.text.secondary }]}>
              {t(`subscription.feature${FEATURE_ICONS.length > idx ? ['AI', 'Properties', 'Tenants', 'Reports'][idx] : 'AI'}`)}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.buyBtn, { backgroundColor: highlighted ? colors.primary : colors.text.primary }]}
          onPress={() => handleBuy(plan)}
          disabled={buyingPlan !== null}
          activeOpacity={0.8}
        >
          {buyingPlan === plan.key ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buyBtnText}>{t('subscription.buy')}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + spacing.md, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text.primary }]}>{t('subscription.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl * 2 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Current plan banner */}
        <View style={[styles.currentCard, { backgroundColor: isPremium ? colors.primaryLight : colors.surface, borderColor: isPremium ? colors.primary : colors.border }]}>
          <View style={styles.currentLeft}>
            <View style={[styles.currentIconBox, { backgroundColor: isPremium ? colors.primary : colors.borderLight }]}>
              <Ionicons name={isPremium ? 'diamond-outline' : 'shield-checkmark-outline'} size={20} color={isPremium ? colors.primary : colors.text.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.currentLabel, { color: colors.text.secondary }]}>{t('subscription.currentPlan')}</Text>
              <Text style={[styles.currentValue, { color: colors.text.primary }]}>
                {isPremium
                  ? t(`subscription.${currentPlan === 'LIFETIME' ? 'lifetime' : currentPlan === 'MONTHLY' ? 'monthly' : 'annual'}`)
                  : t('subscription.currentFree')}
              </Text>
              {isPremium && currentExpiresAt && !['LIFETIME'].includes(currentPlan) && (
                <Text style={[styles.currentExpiry, { color: colors.text.secondary }]}>
                  {t('subscription.expiresOn', { date: new Date(currentExpiresAt).toLocaleDateString() })}
                </Text>
              )}
            </View>
          </View>
          {isPremium && (
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xxl }} />
        ) : plans.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>{t('subscription.unavailable')}</Text>
        ) : (
          <View style={styles.plansList}>
            {plans.map((plan) =>
              renderPlanCard(plan, plan.key === 'ANNUAL')
            )}
          </View>
        )}

        <Text style={[styles.footer, { color: colors.text.tertiary }]}>{t('subscription.subtitle')}</Text>
      </ScrollView>

      {checkingStatus && (
        <View style={styles.statusOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.statusOverlayText}>{t('subscription.checkStatus')}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backButton: {
    padding: spacing.xs,
    width: 44,
  },
  topBarTitle: {
    ...typography.h4,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  currentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  currentIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  currentValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  currentExpiry: {
    fontSize: 12,
    marginTop: 2,
  },
  plansList: {
    gap: spacing.lg,
  },
  planCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: spacing.lg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
  },
  priceSuffix: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: 13,
    flex: 1,
  },
  buyBtn: {
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginVertical: spacing.xxl,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  statusOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
