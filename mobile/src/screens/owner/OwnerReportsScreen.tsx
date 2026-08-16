import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { getExpenses, getExpenseSummary, getProperties, getOwnerAnalytics, type OwnerExpense } from '../../api/owner';
import { getAiEntitlement } from '../../api/ai';
import { useRouter } from 'expo-router';
import { GroupedBarChart, DonutChart, TrendLineChart, HorizontalBarChart, PremiumTag } from '../../components';

const PREMIUM_PLANS = ['MONTHLY', 'ANNUAL', 'LIFETIME'];

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

const METHOD_COLORS = ['#4B6BED', '#16A34A', '#D97706', '#7C3AED', '#64748B'];

const CATEGORY_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', electricity: 'Electricity', water: 'Water',
  society: 'Society', repairs: 'Repairs', cleaning: 'Cleaning', internet: 'Internet', misc: 'Misc',
  subscription: 'Subscription',
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(mm, 10) - 1;
  if (isNaN(idx)) return m;
  return `${months[idx] ?? mm} ${y}`;
};

const shortMonthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(mm, 10) - 1;
  if (isNaN(idx)) return m;
  return months[idx] ?? mm;
};

const shiftMonth = (m: string, dir: number) => {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const OwnerReportsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [month, setMonth] = useState(currentMonth());
  const [propertyId, setPropertyId] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const { data: planData } = useQuery({
    queryKey: ['planStatus', 'owner'],
    queryFn: () => getAiEntitlement('owner'),
    staleTime: 60 * 1000,
    retry: 1,
  });
  const isPremium = PREMIUM_PLANS.includes(planData?.entitlement?.plan || 'FREE');

  const { data: summaryData, isLoading, refetch } = useQuery({
    queryKey: ['ownerExpenseSummary', month, propertyId],
    queryFn: () => getExpenseSummary({ month, propertyId }),
    staleTime: 60 * 1000,
  });

  const { data: expensesData } = useQuery({
    queryKey: ['ownerExpenses', month, propertyId],
    queryFn: () => getExpenses({ month, propertyId }),
    staleTime: 60 * 1000,
  });

  const { data: propData } = useQuery({
    queryKey: ['ownerProperties'],
    queryFn: getProperties,
    staleTime: 5 * 60 * 1000,
  });

  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery({
    // month + propertyId are part of the key so tenant status / property
    // collection / all series refetch when either filter changes.
    queryKey: ['ownerAnalytics', month, propertyId ?? 'all'],
    queryFn: () => getOwnerAnalytics({ month, propertyId }),
    staleTime: 5 * 60 * 1000,
    enabled: isPremium,
  });

  const summary = summaryData?.summary;
  const expenses = expensesData?.expenses ?? [];
  const properties = propData?.properties ?? [];
  const income = summary?.totalIncome ?? 0;

  // Defensive shape: older backends / cached responses may omit newer series.
  // Missing fields become safe empty defaults so charts never receive NaN/undefined.
  const analytics = useMemo(() => {
    if (!analyticsData) return null;
    return {
      collectionTrend: analyticsData.collectionTrend ?? [],
      incomeTrend: analyticsData.incomeTrend ?? [],
      paidVsPending: analyticsData.paidVsPending ?? { paid: 0, pending: 0 },
      occupancy: analyticsData.occupancy ?? { totalRooms: 0, occupiedRooms: 0, vacantRooms: 0, occupancyRate: 0 },
      tenantPaymentStatus: analyticsData.tenantPaymentStatus ?? { paid: 0, partial: 0, pending: 0, overdue: 0 },
      paymentMethods: analyticsData.paymentMethods ?? [],
      propertyCollection: analyticsData.propertyCollection ?? [],
      propertyOccupancy: analyticsData.propertyOccupancy ?? [],
    };
  }, [analyticsData]);

  const promptUpgrade = () => {
    Alert.alert(
      t('subscription.premiumRequiredTitle'),
      t('subscription.reportsPremiumMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('subscription.viewPlans'), onPress: () => router.navigate('/subscription' as any) },
      ]
    );
  };

  const handleExport = async () => {
    if (!isPremium) {
      promptUpgrade();
      return;
    }
    try {
      setExporting(true);
      const { generateOwnerReportPdf } = await import('../../utils/reportPdf');
      await generateOwnerReportPdf({
        month,
        monthLabel: monthLabel(month),
        income: summary?.totalIncome ?? 0,
        expenses: summary?.totalExpenses ?? 0,
        netProfit: summary?.netProfit ?? 0,
        expenseCount: summary?.expenseCount ?? 0,
        propertyName: propertyId ? properties.find(p => p._id === propertyId)?.name ?? 'All properties' : 'All properties',
        items: expenses,
        // Include every premium chart currently visible on screen.
        analytics: analytics,
        labels: {
          monthlyCollection: t('owner.reports.chartMonthlyCollection'),
          paidVsPending: t('owner.reports.chartPaidVsPending'),
          pendingTrend: t('owner.reports.chartPendingTrend'),
          incomeTrend: t('owner.reports.chartIncomeTrend'),
          occupancy: t('owner.reports.chartOccupancy'),
          tenantStatus: t('owner.reports.chartTenantStatus'),
          propertyCollection: t('owner.reports.chartPropertyCollection'),
          propertyOccupancy: t('owner.reports.chartPropertyOccupancy'),
          paymentMethods: t('owner.reports.chartPaymentMethods'),
          collected: t('owner.reports.collected'),
          pending: t('owner.reports.pending'),
          paid: t('owner.reports.paid'),
          partial: t('owner.reports.partial'),
          overdue: t('owner.reports.overdue'),
          occupied: t('owner.reports.occupied'),
          vacant: t('owner.reports.vacant'),
          overall: t('owner.reports.overall'),
          occupancyRate: t('owner.reports.occupancyRate'),
        },
      });
    } catch (e) {
      Alert.alert(t('owner.commonOwner.error'), t('owner.reports.errExport'));
    } finally {
      setExporting(false);
    }
  };

  const changeMonth = (dir: number) => {
    if (dir < 0 && !isPremium) {
      promptUpgrade();
      return;
    }
    setMonth(shiftMonth(month, dir));
  };

  const propertyTabs = [
    { key: undefined as string | undefined, label: 'All' },
    ...properties.map(p => ({ key: p._id, label: p.name })),
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.reports.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>{monthLabel(month)}</Text>
        </View>
        <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.primary }]} onPress={handleExport} disabled={exporting} activeOpacity={0.8}>
          {exporting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="download-outline" size={16} color="#FFF" />}
          <Text style={styles.exportText}>{t('owner.reports.btnPdf')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.compactFilter, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.text.primary }]}>{monthLabel(month)}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propContent}>
          {propertyTabs.map(p => (
            <TouchableOpacity
              key={p.key ?? 'all'}
              style={[styles.propChip, { backgroundColor: (propertyId ?? undefined) === p.key ? colors.primary : colors.surface }, (propertyId ?? undefined) === p.key && { borderColor: colors.primary }]}
              onPress={() => setPropertyId(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.propChipText, { color: (propertyId ?? undefined) === p.key ? '#FFFFFF' : colors.text.secondary }]} numberOfLines={1}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadows.sm]}>
          <View style={styles.summaryHeader}>
            <View style={[styles.summaryIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="stats-chart" size={22} color={colors.primary} />
            </View>
              <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>{t('owner.reports.profitSummary')}</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xxl }} />
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(summary?.totalIncome ?? 0)}</Text>
                   <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>{t('owner.reports.rentCollected')}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(summary?.totalExpenses ?? 0)}</Text>
                   <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>{t('owner.reports.expenses')}</Text>
                </View>
              </View>
              <View style={[styles.netRow, { backgroundColor: (summary?.netProfit ?? 0) >= 0 ? colors.successLight : colors.errorLight }]}>
                 <Text style={[styles.netLabel, { color: (summary?.netProfit ?? 0) >= 0 ? colors.success : colors.error }]}>{t('owner.reports.netProfit')}</Text>
                <Text style={[styles.netValue, { color: (summary?.netProfit ?? 0) >= 0 ? colors.success : colors.error }]}>
                  {formatCurrency(summary?.netProfit ?? 0)}
                </Text>
              </View>
              <Text style={[styles.summaryCount, { color: colors.text.tertiary }]}>
                 {t('owner.reports.expenseRecorded', { count: summary?.expenseCount ?? 0 })}
              </Text>
            </>
          )}
        </View>

        {/* Premium Analytics */}
        {isPremium && (
          <>
            <View style={styles.analyticsTitleRow}>
              <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>
                {t('owner.reports.premiumAnalytics')}
              </Text>
              <PremiumTag small />
            </View>

            {loadingAnalytics && (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            )}

            {!loadingAnalytics && analytics && (
              <>
                {/* Monthly rent collection */}
                <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                  <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                    {t('owner.reports.chartMonthlyCollection')}
                  </Text>
                  <GroupedBarChart
                    data={analytics.collectionTrend.map((m) => ({
                      label: shortMonthLabel(m.month),
                      values: [m.collected, m.pending],
                    }))}
                    series={[
                      { label: t('owner.reports.collected'), color: colors.success },
                      { label: t('owner.reports.pending'), color: colors.error },
                    ]}
                    valueFormat={formatCurrency}
                  />
                </View>

                {/* Paid vs Pending */}
                <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                  <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                    {t('owner.reports.chartPaidVsPending')}
                  </Text>
                  <DonutChart
                    segments={[
                      { label: t('owner.reports.paid'), value: analytics.paidVsPending.paid, color: colors.success },
                      { label: t('owner.reports.pending'), value: analytics.paidVsPending.pending, color: colors.error },
                    ]}
                    size={130}
                    centerLabel={t('owner.reports.overall')}
                    valueFormat={formatCurrency}
                  />
                  {analytics.paidVsPending.pending > 0 && (
                    <TouchableOpacity
                      style={styles.actionRow}
                      onPress={() => router.navigate({ pathname: '/(owner-tabs)/payments', params: { status: 'pending' } } as any)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                      <Text style={[styles.actionText, { color: colors.error }]}>
                        {t('owner.reports.viewPendingPayments')}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Pending rent trend */}
                <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                  <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                    {t('owner.reports.chartPendingTrend')}
                  </Text>
                  <TrendLineChart
                    data={analytics.collectionTrend.map((m) => ({ label: shortMonthLabel(m.month), value: m.pending }))}
                    color={colors.error}
                    valueFormat={formatCurrency}
                  />
                </View>

                {/* Income trend */}
                <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                  <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                    {t('owner.reports.chartIncomeTrend')}
                  </Text>
                  <TrendLineChart
                    data={analytics.incomeTrend.map((m) => ({ label: shortMonthLabel(m.month), value: m.income }))}
                    color={colors.primary}
                    valueFormat={formatCurrency}
                  />
                </View>

                {/* Occupancy */}
                <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                  <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                    {t('owner.reports.chartOccupancy')}
                  </Text>
                  <DonutChart
                    segments={[
                      { label: t('owner.reports.occupied'), value: analytics.occupancy.occupiedRooms, color: colors.primary },
                      { label: t('owner.reports.vacant'), value: analytics.occupancy.vacantRooms, color: colors.border },
                    ]}
                    size={130}
                    centerLabel={t('owner.reports.occupancyRate')}
                    centerValue={`${analytics.occupancy.occupancyRate}%`}
                  />
                  {analytics.occupancy.vacantRooms > 0 && (
                    <TouchableOpacity
                      style={styles.actionRow}
                      onPress={() => router.navigate('/(owner-tabs)/properties' as any)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="business-outline" size={14} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>
                        {t('owner.reports.viewVacantRooms', { count: analytics.occupancy.vacantRooms })}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tenant payment status (current month) */}
                <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                  <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                    {t('owner.reports.chartTenantStatus')}
                  </Text>
                  <HorizontalBarChart
                    data={[
                      { label: t('owner.reports.paid'), value: analytics.tenantPaymentStatus.paid, color: colors.success },
                      { label: t('owner.reports.partial'), value: analytics.tenantPaymentStatus.partial, color: colors.warning },
                      { label: t('owner.reports.pending'), value: analytics.tenantPaymentStatus.pending, color: colors.text.tertiary },
                      { label: t('owner.reports.overdue'), value: analytics.tenantPaymentStatus.overdue, color: colors.error },
                    ]}
                    onRowPress={(i) => {
                      const status = ['paid', 'partial', 'pending', 'overdue'][i];
                      router.navigate({ pathname: '/(owner-tabs)/payments', params: { status } } as any);
                    }}
                  />
                  <Text style={[styles.chartHint, { color: colors.text.tertiary }]}>
                    {t('owner.reports.tapToFilterHint')}
                  </Text>
                </View>

                {/* Property-wise rent collection (current month) */}
                {analytics.propertyCollection.length > 0 && (
                  <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                    <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                      {t('owner.reports.chartPropertyCollection')}
                    </Text>
                    <HorizontalBarChart
                      data={analytics.propertyCollection.map((p) => ({
                        label: p.name,
                        value: p.collected,
                        color: colors.success,
                        subLabel: p.pending > 0 ? t('owner.reports.pendingShort', { amount: formatCurrency(p.pending) }) : undefined,
                      }))}
                      valueFormat={formatCurrency}
                    />
                  </View>
                )}

                {/* Property-wise occupancy */}
                {analytics.propertyOccupancy.length > 0 && (
                  <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                    <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                      {t('owner.reports.chartPropertyOccupancy')}
                    </Text>
                    <HorizontalBarChart
                      data={analytics.propertyOccupancy.map((p) => ({
                        label: p.name,
                        value: p.occupancyRate,
                        color: p.occupancyRate >= 100 ? colors.success : p.occupancyRate > 0 ? colors.primary : colors.border,
                        subLabel: `${p.occupiedRooms}/${p.totalRooms}`,
                      }))}
                      maxValue={100}
                      valueFormat={(n) => `${n}%`}
                      onRowPress={() => router.navigate('/(owner-tabs)/properties' as any)}
                    />
                  </View>
                )}

                {/* Payment method distribution */}
                {analytics.paymentMethods.length > 0 && (
                  <View style={[styles.analyticsCard, { backgroundColor: colors.surface }, shadows.sm]}>
                    <Text style={[styles.analyticsTitle, { color: colors.text.primary }]}>
                      {t('owner.reports.chartPaymentMethods')}
                    </Text>
                    <DonutChart
                      segments={analytics.paymentMethods.map((m, i) => ({
                        label: PAYMENT_METHOD_LABEL[m.method] ?? m.method,
                        value: m.amount,
                        color: METHOD_COLORS[i % METHOD_COLORS.length],
                      }))}
                      size={130}
                      centerLabel={t('owner.reports.collected')}
                      valueFormat={formatCurrency}
                    />
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* Expense breakdown */}
        <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>{t('owner.reports.sectionBreakdown')}</Text>
        <View style={[styles.breakdownCard, { backgroundColor: colors.surface }, shadows.sm]}>
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownIconWrap, { backgroundColor: colors.successLight }]}>
              <Ionicons name="arrow-down" size={16} color={colors.success} />
            </View>
             <Text style={[styles.breakdownLabel, { color: colors.text.primary }]}>{t('owner.reports.totalIncome')}</Text>
            <Text style={[styles.breakdownValue, { color: colors.success }]}>{formatCurrency(income)}</Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
          {expenses.length === 0 ? (
             <Text style={[styles.emptyExp, { color: colors.text.tertiary }]}>{t('owner.reports.emptyExp')}</Text>
          ) : (
            expenses.map(e => (
              <View key={e._id} style={styles.expRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expTitle, { color: colors.text.primary }]} numberOfLines={1}>
                    {e.title || (CATEGORY_LABEL[e.category] ? t(`owner.expenses.cat${CATEGORY_LABEL[e.category].charAt(0) + CATEGORY_LABEL[e.category].slice(1)}`) : e.category)}{e.isRecurring ? ` · ${t('owner.reports.recurringSuffix')}` : ''}
                  </Text>
                  <Text style={[styles.expSub, { color: colors.text.tertiary }]}>
                     {CATEGORY_LABEL[e.category] ? t(`owner.expenses.cat${CATEGORY_LABEL[e.category].charAt(0) + CATEGORY_LABEL[e.category].slice(1)}`) : e.category} · {typeof e.propertyId === 'object' && e.propertyId ? e.propertyId.name : t('owner.commonOwner.property')}
                  </Text>
                </View>
                <Text style={[styles.expAmount, { color: colors.error }]}>- {formatCurrency(e.amount)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { fontSize: 12, marginTop: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.full },
  exportText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  compactFilter: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthLabel: { fontSize: 15, fontWeight: '700', minWidth: 100, textAlign: 'center' },
  propContent: { paddingVertical: spacing.xs, gap: 6, alignItems: 'center' },
  propChip: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10, maxWidth: 140 },
  propChipText: { fontSize: 12, fontWeight: '600' },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  summaryCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryIconWrap: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 15, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '700' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 32 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.md },
  netLabel: { fontSize: 13, fontWeight: '700' },
  netValue: { fontSize: 17, fontWeight: '800' },
  summaryCount: { fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  breakdownCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  breakdownValue: { fontSize: 14, fontWeight: '700' },
  cardDivider: { height: 1 },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expTitle: { fontSize: 13, fontWeight: '600' },
  expSub: { fontSize: 11, marginTop: 2 },
  expAmount: { fontSize: 13, fontWeight: '700' },
  emptyExp: { fontSize: 13, textAlign: 'center', paddingVertical: spacing.sm },
  analyticsTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  analyticsCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  analyticsTitle: { fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.xs },
  actionText: { fontSize: 12, fontWeight: '700' },
  chartHint: { fontSize: 11, textAlign: 'center' },
});