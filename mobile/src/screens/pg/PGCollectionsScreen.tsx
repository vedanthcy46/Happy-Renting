import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { WorkspaceSwitcher } from '../../components/WorkspaceSwitcher';
import { getPaymentSummary, getOwnerRentRecords, getOwnerTenants, getProperties, type OwnerRentRecord } from '../../api/owner';

const formatCurrency = (n?: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const statusChip = (status: string) => {
  switch (status) {
    case 'paid': return { bg: '#DCFCE7', fg: '#16A34A', label: 'Paid' };
    case 'partial': return { bg: '#FEF3C7', fg: '#D97706', label: 'Partial' };
    case 'overdue': return { bg: '#FEE2E2', fg: '#DC2626', label: 'Overdue' };
    default: return { bg: '#E2E8F0', fg: '#64748B', label: 'Pending' };
  }
};

type FilterKey = 'all' | 'paid' | 'pending' | 'overdue';

export const PGCollectionsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data: propertiesData } = useQuery({ queryKey: ['ownerProperties'], queryFn: getProperties, staleTime: 5 * 60 * 1000 });
  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: ['ownerPaymentSummary', selectedPropertyId ?? 'all'],
    queryFn: () => getPaymentSummary(selectedPropertyId ?? undefined),
    staleTime: 2 * 60 * 1000,
  });
  const { data: recordsData, refetch: refetchRecords } = useQuery({
    queryKey: ['ownerRentRecords', currentMonthKey(), selectedPropertyId ?? 'all'],
    queryFn: () => getOwnerRentRecords({ month: currentMonthKey(), limit: 500, propertyId: selectedPropertyId ?? undefined }),
    staleTime: 2 * 60 * 1000,
  });
  const { data: tenantsData } = useQuery({
    queryKey: ['ownerTenants'],
    queryFn: () => getOwnerTenants(),
    staleTime: 2 * 60 * 1000,
  });

  const properties = propertiesData?.properties ?? [];
  const metrics = summaryData?.metrics;

  const pgUserIds = useMemo(() => {
    const set = new Set<string>();
    for (const tn of tenantsData?.tenants ?? []) {
      if (tn.roomId?.type === 'pg') {
        const uid = typeof tn.userId === 'string' ? tn.userId : tn.userId?._id;
        if (uid) set.add(uid);
      }
    }
    return set;
  }, [tenantsData]);

  const records = (recordsData?.rentRecords ?? []).filter(r => {
    const uid = typeof r.userId === 'string' ? r.userId : r.userId?._id;
    return uid ? pgUserIds.has(uid) : false;
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return records;
    if (filter === 'paid') return records.filter(r => r.status === 'paid');
    if (filter === 'overdue') return records.filter(r => r.status === 'overdue');
    return records.filter(r => r.status === 'pending' || r.status === 'partial');
  }, [records, filter]);

  const pendingCount = records.filter(r => r.status === 'pending' || r.status === 'partial').length;
  const overdueCount = records.filter(r => r.status === 'overdue').length;
  const paidCount = records.filter(r => r.status === 'paid').length;
  const collectedThisMonth = records.reduce((s, r) => s + (r.totalPaid ?? 0), 0);
  const pendingAmount = records.reduce((s, r) => s + (r.status === 'paid' ? 0 : r.remainingAmount ?? 0), 0);

  const isLoading = !summaryData && !recordsData;
  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('pg.collections.filterAll') },
    { key: 'paid', label: t('pg.collections.filterPaid') },
    { key: 'pending', label: t('pg.collections.filterPending') },
    { key: 'overdue', label: t('pg.collections.filterOverdue') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#0D9488', '#0F766E']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('pg.collections.title')}</Text>
          <Text style={styles.headerSub}>{t('pg.collections.sub')}</Text>
          <View style={styles.headerChipWrap}>
            <WorkspaceSwitcher variant="chip" />
          </View>
        </View>
        <View style={{ width: 26 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { refetchSummary(); refetchRecords(); }} tintColor={colors.primary} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyChips}>
          <TouchableOpacity
            style={[styles.propertyChip, { backgroundColor: !selectedPropertyId ? colors.primary : colors.surface, borderColor: !selectedPropertyId ? colors.primary : colors.border }]}
            onPress={() => setSelectedPropertyId(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.propertyChipText, { color: !selectedPropertyId ? '#FFFFFF' : colors.text.secondary }]}>
              {t('pg.dashboard.allProperties')}
            </Text>
          </TouchableOpacity>
          {properties.map(p => (
            <TouchableOpacity
              key={p._id}
              style={[styles.propertyChip, { backgroundColor: selectedPropertyId === p._id ? colors.primary : colors.surface, borderColor: selectedPropertyId === p._id ? colors.primary : colors.border }]}
              onPress={() => setSelectedPropertyId(selectedPropertyId === p._id ? null : p._id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.propertyChipText, { color: selectedPropertyId === p._id ? '#FFFFFF' : colors.text.secondary }]} numberOfLines={1}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadows.md]}>
          <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>{t('pg.collections.monthCollected')}</Text>
          <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
            {isLoading ? '…' : formatCurrency(collectedThisMonth)}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.success }]}>{isLoading ? '…' : formatCurrency(metrics?.collectionsToday ?? 0)}</Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('pg.collections.today')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.warning }]}>{isLoading ? '…' : formatCurrency(pendingAmount)}</Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('pg.collections.pending')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.error }]}>{isLoading ? '…' : formatCurrency(metrics?.totalOutstanding ?? 0)}</Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>{t('pg.collections.outstanding')}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.countRow}>
            <Text style={[styles.countChip, { color: colors.success, backgroundColor: colors.successLight }]}>{paidCount} {t('pg.collections.paidBills')}</Text>
            <Text style={[styles.countChip, { color: colors.warning, backgroundColor: colors.warningLight }]}>{pendingCount} {t('pg.collections.pendingBills')}</Text>
            <Text style={[styles.countChip, { color: colors.error, backgroundColor: colors.errorLight }]}>{overdueCount} {t('pg.collections.overdueBills')}</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {filters.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, { backgroundColor: filter === f.key ? colors.primary : colors.surface, borderColor: filter === f.key ? colors.primary : colors.border }]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, { color: filter === f.key ? '#FFFFFF' : colors.text.secondary }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('pg.collections.emptyTitle')}</Text>
            <Text style={[styles.emptySub, { color: colors.text.tertiary }]}>{t('pg.collections.emptySub')}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {filtered.map(r => {
              const chip = statusChip(r.status);
              return (
                <TouchableOpacity key={r._id} style={[styles.recordCard, { backgroundColor: colors.surface }, shadows.sm]} onPress={() => router.push(`/owner/transactions/${r._id}` as any)} activeOpacity={0.75}>
                  <View style={styles.recordTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recordName, { color: colors.text.primary }]} numberOfLines={1}>{r.userId?.name ?? 'Resident'}</Text>
                      <Text style={[styles.recordRoom, { color: colors.text.secondary }]}>Room {r.roomId?.roomNumber ?? '—'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: chip.bg }]}>
                      <Text style={[styles.statusText, { color: chip.fg }]}>{chip.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
                  <View style={styles.recordMetaRow}>
                    <Text style={[styles.recordMeta, { color: colors.text.secondary }]}>{t('pg.collections.rent')}: <Text style={[styles.recordMetaStrong, { color: colors.text.primary }]}>{formatCurrency(r.totalRent)}</Text></Text>
                    <Text style={[styles.recordMeta, { color: colors.text.secondary }]}>{t('pg.collections.paid')}: <Text style={[styles.recordMetaStrong, { color: colors.success }]}>{formatCurrency(r.totalPaid)}</Text></Text>
                    <Text style={[styles.recordMeta, { color: colors.text.secondary }]}>{t('pg.collections.remaining')}: <Text style={[styles.recordMetaStrong, { color: colors.error }]}>{formatCurrency(r.remainingAmount)}</Text></Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
  },
  headerCenter: { flex: 1, alignItems: 'center', marginTop: -2 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },
  headerChipWrap: { marginTop: spacing.sm },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  propertyChips: { gap: spacing.sm, paddingVertical: 2 },
  propertyChip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 14 },
  propertyChipText: { fontSize: 13, fontWeight: '600', maxWidth: 160 },
  summaryCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  divider: { height: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemValue: { fontSize: 15, fontWeight: '700' },
  summaryItemLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 26 },
  countRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  countChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  filterRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  filterChip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 48, paddingHorizontal: spacing.huge },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  recordCard: { borderRadius: radius.xl, padding: spacing.lg },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recordName: { fontSize: 15, fontWeight: '700' },
  recordRoom: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDivider: { height: 1, marginVertical: spacing.md },
  recordMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  recordMeta: { fontSize: 12 },
  recordMetaStrong: { fontWeight: '700' },
});