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
import { useAuthStore } from '../../store/useAuthStore';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { WorkspaceSwitcher } from '../../components/WorkspaceSwitcher';
import {
  getPaymentSummary, getOwnerAnalytics, getProperties, getOwnerTenants, getRooms, getComplaints,
} from '../../api/owner';

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
  onPress?: () => void;
}

const StatTile: React.FC<StatTileProps> = ({ icon, label, value, accent, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.statTile, { backgroundColor: colors.surface }, shadows.sm]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={[styles.statIconWrap, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.statValue, { color: colors.text.primary }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.text.secondary }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
};

interface AttentionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  accent: string;
  onPress?: () => void;
}

const AttentionRow: React.FC<AttentionRowProps> = ({ icon, title, sub, accent, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.attentionRow, { backgroundColor: colors.surface }, shadows.sm]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.attentionIcon, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.attentionTitle, { color: colors.text.primary }]}>{title}</Text>
        <Text style={[styles.attentionSub, { color: colors.text.secondary }]}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </TouchableOpacity>
  );
};

export const PGDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const firstName = user?.name?.split(' ')[0] ?? 'Owner';

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data: propertiesData } = useQuery({
    queryKey: ['ownerProperties'],
    queryFn: getProperties,
    staleTime: 5 * 60 * 1000,
  });
  const { data: roomsData, refetch: refetchRooms } = useQuery({
    queryKey: ['ownerRooms', selectedPropertyId ?? 'all'],
    queryFn: () => getRooms(selectedPropertyId ?? undefined),
    staleTime: 2 * 60 * 1000,
  });
  const { data: analyticsData } = useQuery({
    queryKey: ['ownerAnalytics', selectedPropertyId ?? 'all'],
    queryFn: () => getOwnerAnalytics({ propertyId: selectedPropertyId ?? undefined }),
    staleTime: 3 * 60 * 1000,
  });
  const { data: summaryData } = useQuery({
    queryKey: ['ownerPaymentSummary', selectedPropertyId ?? 'all'],
    queryFn: () => getPaymentSummary(selectedPropertyId ?? undefined),
    staleTime: 2 * 60 * 1000,
  });
  const { data: tenantsData } = useQuery({
    queryKey: ['ownerTenants', 'active'],
    queryFn: () => getOwnerTenants({ status: 'active' }),
    staleTime: 2 * 60 * 1000,
  });
  const { data: complaintsData } = useQuery({
    queryKey: ['ownerComplaints'],
    queryFn: getComplaints,
    staleTime: 60 * 1000,
  });

  const properties = propertiesData?.properties ?? [];
  const pgRooms = (roomsData?.rooms ?? []).filter(r => r.type === 'pg');
  const activeTenants = tenantsData?.tenants ?? [];
  const complaints = complaintsData?.complaints ?? [];

  const totalBeds = pgRooms.reduce((s, r) => s + (r.totalBeds ?? r.beds?.length ?? 0), 0);
  const occupiedBeds = pgRooms.reduce((s, r) => s + (r.occupiedBeds ?? 0), 0);
  const availableBeds = totalBeds - occupiedBeds;
  const bedPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const metrics = summaryData?.metrics;
  const collectionTrend = analyticsData?.collectionTrend ?? [];
  const monthCollected = collectionTrend.length > 0 ? collectionTrend[collectionTrend.length - 1]?.collected ?? 0 : 0;
  const monthPending = collectionTrend.length > 0 ? collectionTrend[collectionTrend.length - 1]?.pending ?? 0 : 0;

  const pendingRentCount = (metrics?.pendingCount ?? 0) + (metrics?.overdueCount ?? 0);
  const unresolvedComplaints = complaints.filter(c => c.status === 'pending' || c.status === 'in-progress').length;

  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingMoveOuts = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const end = weekFromNow.getTime();
    return activeTenants.filter(t => {
      if (!t.exitDate) return false;
      const ts = new Date(t.exitDate).getTime();
      return ts >= start && ts <= end;
    });
  }, [activeTenants, today, weekFromNow]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = !roomsData || !summaryData || !analyticsData;

  const onRefresh = () => {
    refetchRooms();
  };

  const attentionRows: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; accent: string; onPress?: () => void }[] = [];
  if (pendingRentCount > 0) {
    attentionRows.push({
      icon: 'cash-outline',
      title: t('pg.dashboard.needsPendingRent', { count: pendingRentCount }),
      sub: t('pg.dashboard.needsPendingRentSub'),
      accent: colors.warning,
      onPress: () => router.push('/(pg-tabs)/collections' as any),
    });
  }
  if (availableBeds > 0) {
    attentionRows.push({
      icon: 'bed-outline',
      title: t('pg.dashboard.needsVacantBeds', { count: availableBeds }),
      sub: t('pg.dashboard.needsVacantBedsSub'),
      accent: colors.info,
      onPress: () => router.push('/(pg-tabs)/rooms' as any),
    });
  }
  if (unresolvedComplaints > 0) {
    attentionRows.push({
      icon: 'construct-outline',
      title: t('pg.dashboard.needsComplaints', { count: unresolvedComplaints }),
      sub: t('pg.dashboard.needsComplaintsSub'),
      accent: colors.error,
      onPress: () => router.push('/owner/complaints' as any),
    });
  }
  if (upcomingMoveOuts.length > 0) {
    attentionRows.push({
      icon: 'log-out-outline',
      title: t('pg.dashboard.needsMoveOuts', { count: upcomingMoveOuts.length }),
      sub: t('pg.dashboard.needsMoveOutsSub'),
      accent: colors.primary,
      onPress: () => router.push('/(pg-tabs)/residents' as any),
    });
  }

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
          <Text style={styles.headerTitle}>{t('pg.dashboard.title')}</Text>
          <Text style={styles.headerSub}>{t('pg.dashboard.welcome', { name: firstName })}</Text>
          <View style={styles.headerChipWrap}>
            <WorkspaceSwitcher variant="chip" />
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Property selector */}
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

        {/* Occupancy hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface }, shadows.md]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.heroLabel, { color: colors.text.secondary }]}>{t('pg.dashboard.occupancy')}</Text>
              <Text style={[styles.heroValue, { color: colors.text.primary }]}>
                {isLoading ? '…' : `${bedPct}%`}
              </Text>
            </View>
            <View style={[styles.heroRing, { borderColor: colors.primary }]}>
              <Text style={[styles.heroRingText, { color: colors.primary }]}>{isLoading ? '…' : `${bedPct}%`}</Text>
            </View>
          </View>
          <Text style={[styles.heroSub, { color: colors.text.secondary }]}>
            {isLoading ? '…' : t('pg.dashboard.bedsOccupied', { occupied: occupiedBeds, total: totalBeds })}
          </Text>
          <View style={[styles.heroBar, { backgroundColor: colors.borderLight }]}>
            <View style={[styles.heroFill, { backgroundColor: colors.primary, width: `${Math.min(100, bedPct)}%` }]} />
          </View>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMeta}>
              <Text style={[styles.heroMetaValue, { color: colors.success }]}>{isLoading ? '…' : String(availableBeds)}</Text>
              <Text style={[styles.heroMetaLabel, { color: colors.text.secondary }]}>{t('pg.dashboard.availableBeds')}</Text>
            </View>
            <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
            <View style={styles.heroMeta}>
              <Text style={[styles.heroMetaValue, { color: colors.text.primary }]}>{isLoading ? '…' : String(activeTenants.length)}</Text>
              <Text style={[styles.heroMetaLabel, { color: colors.text.secondary }]}>{t('pg.dashboard.residents')}</Text>
            </View>
            <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
            <View style={styles.heroMeta}>
              <Text style={[styles.heroMetaValue, { color: colors.text.primary }]}>{isLoading ? '…' : String(totalBeds)}</Text>
              <Text style={[styles.heroMetaLabel, { color: colors.text.secondary }]}>{t('pg.dashboard.totalBeds')}</Text>
            </View>
          </View>
        </View>

        {/* Money stats */}
        <View style={styles.statsGrid}>
          <StatTile icon="today-outline" label={t('pg.dashboard.todayCollection')} value={isLoading ? '…' : formatCurrency(metrics?.collectionsToday ?? 0)} accent="#0D9488" />
          <StatTile icon="wallet-outline" label={t('pg.dashboard.monthCollection')} value={isLoading ? '…' : formatCurrency(monthCollected)} accent="#4B6BED" />
          <StatTile icon="time-outline" label={t('pg.dashboard.monthPending')} value={isLoading ? '…' : formatCurrency(monthPending)} accent="#D97706" />
          <StatTile icon="cash-outline" label={t('pg.dashboard.totalOutstanding')} value={isLoading ? '…' : formatCurrency(metrics?.totalOutstanding ?? 0)} accent="#DC2626" />
        </View>

        {/* Needs attention */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('pg.dashboard.needsAttention')}</Text>
        </View>
        {attentionRows.length === 0 ? (
          <View style={[styles.emptyAttention, { backgroundColor: colors.surface }, shadows.sm]}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
            <Text style={[styles.emptyAttentionText, { color: colors.text.secondary }]}>{t('pg.dashboard.needsEmpty')}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {attentionRows.map((r, i) => <AttentionRow key={i} {...r} />)}
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
  propertyChip: {
    borderWidth: 1, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 14,
  },
  propertyChipText: { fontSize: 13, fontWeight: '600', maxWidth: 160 },
  heroCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabel: { fontSize: 13, fontWeight: '600' },
  heroValue: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  heroRing: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 5, alignItems: 'center', justifyContent: 'center',
  },
  heroRingText: { fontSize: 15, fontWeight: '800' },
  heroSub: { fontSize: 13, fontWeight: '500', marginTop: -spacing.md },
  heroBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 4 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  heroMeta: { alignItems: 'center', flex: 1 },
  heroMetaValue: { fontSize: 16, fontWeight: '700' },
  heroMetaLabel: { fontSize: 11, marginTop: 2 },
  heroMetaDivider: { width: 1, height: 28 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statTile: {
    flex: 1, minWidth: '46%', borderRadius: radius.xl, padding: spacing.md, gap: spacing.xs,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, lineHeight: 14 },
  sectionHeader: { marginTop: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  emptyAttention: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.xl, padding: spacing.md,
  },
  emptyAttentionText: { fontSize: 13, fontWeight: '500' },
  attentionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.xl, padding: spacing.md,
  },
  attentionIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  attentionTitle: { fontSize: 14, fontWeight: '600' },
  attentionSub: { fontSize: 12, marginTop: 1 },
});