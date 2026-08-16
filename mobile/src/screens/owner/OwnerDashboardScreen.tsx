import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { WorkspaceSwitcher } from '../../components/WorkspaceSwitcher';
import { UpdateCard, PlanStatusCard, PremiumTag } from '../../components';
import { getAiEntitlement } from '../../api/ai';
import {
  getPaymentSummary,
  getExpenseSummary,
  getProperties,
  getOwnerTenants,
  getRooms,
  type PaymentSummaryMetrics,
} from '../../api/owner';

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
  onPress?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, accent, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: colors.surface }, shadows.sm]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={[styles.statIconWrap, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={[styles.statValue, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{label}</Text>
    </TouchableOpacity>
  );
};

interface SectionRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

const SectionRow: React.FC<SectionRowProps> = ({ label, value, valueColor }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionRowLabel, { color: colors.text.secondary }]}>{label}</Text>
      <Text style={[styles.sectionRowValue, { color: valueColor ?? colors.text.primary }]}>
        {value}
      </Text>
    </View>
  );
};

interface OwnerDashboardScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export const OwnerDashboardScreen: React.FC<OwnerDashboardScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const firstName = user?.name?.split(' ')[0] ?? 'Owner';

  // â”€â”€ Data fetching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const {
    data: summaryData,
    isLoading: loadingSummary,
    refetch: refetchSummary,
    isError: errorSummary,
  } = useQuery({
    queryKey: ['ownerPaymentSummary'],
    queryFn: () => getPaymentSummary(),
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: expenseSummaryData,
    isLoading: loadingExpenseSummary,
    refetch: refetchExpenseSummary,
    isError: errorExpenseSummary,
  } = useQuery({
    queryKey: ['ownerExpenseSummary', currentMonthKey()],
    queryFn: () => getExpenseSummary({ month: currentMonthKey() }),
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: propertiesData,
    isLoading: loadingProperties,
    refetch: refetchProperties,
  } = useQuery({
    queryKey: ['ownerProperties'],
    queryFn: getProperties,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: tenantsData,
    isLoading: loadingTenants,
    refetch: refetchTenants,
  } = useQuery({
    queryKey: ['ownerTenants', 'active'],
    queryFn: () => getOwnerTenants({ status: 'active' }),
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: roomsData,
    isLoading: loadingRooms,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ['ownerRooms'],
    queryFn: () => getRooms(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: planData } = useQuery({
    queryKey: ['planStatus', 'owner'],
    queryFn: () => getAiEntitlement('owner'),
    staleTime: 60 * 1000,
  });
  const isPremium = ['MONTHLY', 'ANNUAL', 'LIFETIME'].includes(planData?.entitlement?.plan || 'FREE');

  const promptUpgrade = useCallback(() => {
    Alert.alert(
      t('subscription.premiumRequiredTitle'),
      t('subscription.reportsPremiumMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('subscription.viewPlans'), onPress: () => router.navigate('/subscription' as any) },
      ]
    );
  }, [router, t]);

  const openFullHistory = useCallback(() => {
    if (!isPremium) {
      promptUpgrade();
      return;
    }
    router.navigate('/owner/reports' as any);
  }, [isPremium, promptUpgrade, router]);

  const isLoading = loadingSummary || loadingExpenseSummary || loadingProperties || loadingTenants || loadingRooms;

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchSummary(),
      refetchExpenseSummary(),
      refetchProperties(),
      refetchTenants(),
      refetchRooms(),
    ]);
  }, [refetchSummary, refetchExpenseSummary, refetchProperties, refetchTenants, refetchRooms]);

  // â”€â”€ Derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const metrics: PaymentSummaryMetrics | undefined = summaryData?.metrics;
  const properties = propertiesData?.properties ?? [];
  const activeTenants = tenantsData?.count ?? 0;
  const rooms = roomsData?.rooms ?? [];
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.currentOccupancy > 0).length;
  const occupancyPct =
    totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const expenseSummary = expenseSummaryData?.summary;
  const netCollection = expenseSummary?.netProfit ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* â”€â”€ Header â”€â”€ */}
      <LinearGradient
        colors={['#4B6BED', '#3D56C9']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('owner.dashboard.title')}</Text>
          <Text style={styles.headerSub}>{t('owner.dashboard.welcome', { name: firstName })}</Text>
          <View style={styles.headerChipWrap}>
            <WorkspaceSwitcher variant="chip" />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onNavigate('notifications')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* â”€â”€ Collection summary card â”€â”€ */}
        <UpdateCard />
        <PlanStatusCard workspace="owner" />
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadows.md]}>
          <Text style={[styles.summaryCardTitle, { color: colors.text.secondary }]}>
            {t('owner.dashboard.totalCollected')}
          </Text>
          {loadingSummary ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
          ) : (
            <Text style={[styles.summaryCardValue, { color: colors.text.primary }]}>
              {formatCurrency(metrics?.totalCollected ?? 0)}
            </Text>
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.success }]}>
                {formatCurrency(metrics?.collectionsToday ?? 0)}
              </Text>
               <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('owner.dashboard.today')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.warning }]}>
                {formatCurrency(metrics?.totalOverdue ?? 0)}
              </Text>
               <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('owner.dashboard.overdue')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.text.secondary }]}>
                {formatCurrency(metrics?.totalOutstanding ?? 0)}
              </Text>
               <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('owner.dashboard.outstanding')}</Text>
            </View>
          </View>
        </View>

        {/* â”€â”€ Net collection & expenses card â”€â”€ */}
        <View style={[styles.netCard, { backgroundColor: colors.surface }, shadows.md]}>
          <View style={styles.netHeader}>
            <View style={styles.netHeaderLeft}>
              <View style={styles.netTitleRow}>
                <Text style={[styles.netCardTitle, { color: colors.text.secondary }]}>
                  {t('owner.dashboard.netCollectionMonth')}
                </Text>
                {!isPremium && <PremiumTag label={t('subscription.premium')} small />}
              </View>
              {loadingExpenseSummary ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
              ) : (
                <Text style={[styles.netCardValue, { color: netCollection >= 0 ? colors.success : colors.error }]}>
                  {formatCurrency(netCollection)}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.netIconWrap,
                { backgroundColor: (netCollection >= 0 ? colors.success : colors.error) + '18' },
              ]}
            >
              <Ionicons
                name={netCollection >= 0 ? 'trending-up' : 'trending-down'}
                size={22}
                color={netCollection >= 0 ? colors.success : colors.error}
              />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.success }]}>
                {loadingExpenseSummary ? '…' : formatCurrency(expenseSummary?.totalIncome ?? 0)}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('owner.dashboard.collected')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.error }]}>
                {loadingExpenseSummary ? '…' : formatCurrency(expenseSummary?.totalExpenses ?? 0)}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('owner.dashboard.expenses')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.text.primary }]}>
                {loadingExpenseSummary ? '…' : String(expenseSummary?.expenseCount ?? 0)}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('owner.dashboard.entries')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.netCta, { borderColor: colors.border }]}
            onPress={openFullHistory}
            activeOpacity={0.75}
          >
            <Text style={[styles.netCtaText, { color: colors.text.secondary }]}>
              {t(isPremium ? 'owner.dashboard.viewFullHistory' : 'owner.dashboard.unlockFullHistory')}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* â”€â”€ Stats grid â”€â”€ */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.dashboard.overview')}</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="business-outline"
            label={t('owner.dashboard.properties')}
            value={loadingProperties ? '…' : String(properties.length)}
            accent="#4B6BED"
            onPress={() => onNavigate('properties')}
          />
          <StatCard
            icon="bed-outline"
            label={t('owner.dashboard.rooms')}
            value={loadingRooms ? '…' : String(totalRooms)}
            accent="#7C3AED"
            onPress={() => onNavigate('properties')}
          />
          <StatCard
            icon="people-outline"
            label={t('owner.dashboard.activeTenants')}
            value={loadingTenants ? '…' : String(activeTenants)}
            accent="#059669"
            onPress={() => onNavigate('tenants')}
          />
          <StatCard
            icon="trending-up-outline"
            label={t('owner.dashboard.occupancy')}
            value={loadingRooms ? '…' : `${occupancyPct}%`}
            accent="#D97706"
          />
          <StatCard
            icon="checkmark-circle-outline"
            label={t('owner.dashboard.paidBills')}
            value={loadingSummary ? '…' : String(metrics?.paidCount ?? 0)}
            accent="#16A34A"
            onPress={() => onNavigate('payments')}
          />
          <StatCard
            icon="alert-circle-outline"
            label={t('owner.dashboard.overdueBills')}
            value={loadingSummary ? '…' : String(metrics?.overdueCount ?? 0)}
            accent="#DC2626"
            onPress={() => onNavigate('payments')}
          />
        </View>

        {/* â”€â”€ Payment breakdown card â”€â”€ */}
        <View style={[styles.breakdownCard, { backgroundColor: colors.surface }, shadows.sm]}>
          <Text style={[styles.breakdownTitle, { color: colors.text.primary }]}>
            {t('owner.dashboard.paymentBreakdown')}
          </Text>
          {loadingSummary ? (
            <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />
          ) : (
            <>
              <SectionRow
                label={t('owner.dashboard.pendingBills')}
                value={String(metrics?.pendingCount ?? 0)}
                valueColor={colors.warning}
              />
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <SectionRow
                label={t('owner.dashboard.partialPayments')}
                value={String(metrics?.partialCount ?? 0)}
                valueColor={colors.info}
              />
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <SectionRow
                label={t('owner.dashboard.overdueBillsBreakdown')}
                value={String(metrics?.overdueCount ?? 0)}
                valueColor={colors.error}
              />
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <SectionRow
                label={t('owner.dashboard.totalOutstanding')}
                value={formatCurrency(metrics?.totalOutstanding ?? 0)}
                valueColor={colors.error}
              />
            </>
          )}
        </View>

        {/* â”€â”€ Properties quick list â”€â”€ */}
        {properties.length > 0 && (
          <>
             <View style={styles.sectionHeader}>
               <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.dashboard.properties')}</Text>
               <TouchableOpacity onPress={() => onNavigate('properties')} activeOpacity={0.7}>
                 <Text style={[styles.seeAll, { color: colors.primary }]}>{t('owner.dashboard.seeAll')}</Text>
               </TouchableOpacity>
             </View>
            {properties.slice(0, 3).map(p => (
              <TouchableOpacity
                key={p._id}
                style={[styles.propertyRow, { backgroundColor: colors.surface }, shadows.sm]}
                onPress={() => onNavigate('properties')}
                activeOpacity={0.75}
              >
                <View style={[styles.propertyIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="business" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.propertyName, { color: colors.text.primary }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[styles.propertyAddress, { color: colors.text.secondary }]} numberOfLines={1}>
                    {p.address}{p.city ? `, ${p.city}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {errorSummary && (
          <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
            <Ionicons name="warning-outline" size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>
              {t('owner.dashboard.loadError')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerChipWrap: { marginTop: spacing.sm, alignItems: 'flex-start' },
  scroll: { padding: spacing.xl, gap: spacing.lg },

  // Summary card
  summaryCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  summaryCardTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryCardValue: { fontSize: 32, fontWeight: '700', letterSpacing: -1, marginTop: spacing.xs },
  divider: { height: 1, marginVertical: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemValue: { fontSize: 16, fontWeight: '700' },
  summaryItemLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 32 },

  // Net collection & expenses card
  netCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  netHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netHeaderLeft: { flex: 1 },
  netTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  netCardTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  netCardValue: { fontSize: 32, fontWeight: '700', letterSpacing: -1, marginTop: spacing.xs },
  netIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  netCtaText: { fontSize: 13, fontWeight: '600' },

  // Stat grid
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    width: '47.5%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '500' },

  // Breakdown card
  breakdownCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  breakdownTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  sectionRowLabel: { fontSize: 14 },
  sectionRowValue: { fontSize: 14, fontWeight: '600' },

  // Properties list
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  propertyIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyName: { fontSize: 14, fontWeight: '600' },
  propertyAddress: { fontSize: 12, marginTop: 2 },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: { fontSize: 13, flex: 1 },
});
