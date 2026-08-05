import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { getExpenses, getExpenseSummary, getProperties, type OwnerExpense } from '../../api/owner';

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const CATEGORY_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', electricity: 'Electricity', water: 'Water',
  society: 'Society', repairs: 'Repairs', cleaning: 'Cleaning', internet: 'Internet', misc: 'Misc',
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

const shiftMonth = (m: string, dir: number) => {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const OwnerReportsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [month, setMonth] = useState(currentMonth());
  const [propertyId, setPropertyId] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

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

  const summary = summaryData?.summary;
  const expenses = expensesData?.expenses ?? [];
  const properties = propData?.properties ?? [];
  const income = summary?.totalIncome ?? 0;

  const handleExport = async () => {
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
      });
    } catch (e) {
      Alert.alert('Error', 'Could not export report. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const propertyTabs = [
    { key: undefined as string | undefined, label: 'All' },
    ...properties.map(p => ({ key: p._id, label: p.name })),
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Reports</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>{monthLabel(month)}</Text>
        </View>
        <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.primary }]} onPress={handleExport} disabled={exporting} activeOpacity={0.8}>
          {exporting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="download-outline" size={18} color="#FFF" />}
          <Text style={styles.exportText}>PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Month / property selector */}
      <View style={[styles.selectorRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text.primary }]}>{monthLabel(month)}</Text>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.propScroll, { borderBottomColor: colors.border }]} contentContainerStyle={styles.propContent}>
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

      <ScrollView
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
            <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>Profit Summary</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xxl }} />
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(summary?.totalIncome ?? 0)}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Rent Collected</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(summary?.totalExpenses ?? 0)}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Expenses</Text>
                </View>
              </View>
              <View style={[styles.netRow, { backgroundColor: (summary?.netProfit ?? 0) >= 0 ? colors.successLight : colors.errorLight }]}>
                <Text style={[styles.netLabel, { color: (summary?.netProfit ?? 0) >= 0 ? colors.success : colors.error }]}>Net Profit</Text>
                <Text style={[styles.netValue, { color: (summary?.netProfit ?? 0) >= 0 ? colors.success : colors.error }]}>
                  {formatCurrency(summary?.netProfit ?? 0)}
                </Text>
              </View>
              <Text style={[styles.summaryCount, { color: colors.text.tertiary }]}>
                {summary?.expenseCount ?? 0} expenses recorded this month
              </Text>
            </>
          )}
        </View>

        {/* Expense breakdown */}
        <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>Income & Expense Breakdown</Text>
        <View style={[styles.breakdownCard, { backgroundColor: colors.surface }, shadows.sm]}>
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownIconWrap, { backgroundColor: colors.successLight }]}>
              <Ionicons name="arrow-down" size={16} color={colors.success} />
            </View>
            <Text style={[styles.breakdownLabel, { color: colors.text.primary }]}>Total Income</Text>
            <Text style={[styles.breakdownValue, { color: colors.success }]}>{formatCurrency(income)}</Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
          {expenses.length === 0 ? (
            <Text style={[styles.emptyExp, { color: colors.text.tertiary }]}>No expenses recorded for this period.</Text>
          ) : (
            expenses.map(e => (
              <View key={e._id} style={styles.expRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expTitle, { color: colors.text.primary }]} numberOfLines={1}>
                    {e.title || CATEGORY_LABEL[e.category] || e.category}{e.isRecurring ? ' · recurring' : ''}
                  </Text>
                  <Text style={[styles.expSub, { color: colors.text.tertiary }]}>
                    {CATEGORY_LABEL[e.category] || e.category} · {typeof e.propertyId === 'object' && e.propertyId ? e.propertyId.name : 'Property'}
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
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full },
  exportText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  selectorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  propScroll: { borderBottomWidth: StyleSheet.hairlineWidth },
  propContent: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  propChip: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12, maxWidth: 160 },
  propChipText: { fontSize: 13, fontWeight: '600' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  summaryCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryIconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.md },
  netLabel: { fontSize: 14, fontWeight: '700' },
  netValue: { fontSize: 18, fontWeight: '800' },
  summaryCount: { fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  breakdownCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  breakdownValue: { fontSize: 15, fontWeight: '700' },
  cardDivider: { height: 1 },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expTitle: { fontSize: 14, fontWeight: '600' },
  expSub: { fontSize: 11, marginTop: 2 },
  expAmount: { fontSize: 14, fontWeight: '700' },
  emptyExp: { fontSize: 13, textAlign: 'center', paddingVertical: spacing.sm },
});