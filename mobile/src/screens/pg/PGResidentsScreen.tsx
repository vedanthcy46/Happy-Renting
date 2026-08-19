import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput,
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
import { getOwnerTenants, getOwnerRentRecords, getProperties, type OwnerTenant } from '../../api/owner';

const formatCurrency = (n?: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const stayDays = (dateStr?: string) => {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000)));
};

const roomLabel = (tenant: OwnerTenant) => {
  const base = `Room ${tenant.roomId.roomNumber}${tenant.roomId.floor ? ` · ${tenant.roomId.floor}` : ''}`;
  if (tenant.roomId.type === 'pg' && tenant.bedId) {
    const bed = (tenant.roomId.beds ?? []).find(b => b._id === tenant.bedId);
    if (bed) return `${base} · ${bed.bedNumber}`;
  }
  return base;
};

type FilterKey = 'all' | 'active' | 'pending' | 'moving';

export const PGResidentsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [filter, setFilter] = useState<FilterKey>('active');
  const [query, setQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data: propertiesData } = useQuery({ queryKey: ['ownerProperties'], queryFn: getProperties, staleTime: 5 * 60 * 1000 });
  const { data: tenantsData, isLoading, refetch } = useQuery({
    queryKey: ['ownerTenants', selectedPropertyId ?? 'all'],
    queryFn: () => getOwnerTenants(selectedPropertyId ? { propertyId: selectedPropertyId } : undefined),
    staleTime: 2 * 60 * 1000,
  });
  const { data: recordsData } = useQuery({
    queryKey: ['ownerRentRecords', currentMonthKey()],
    queryFn: () => getOwnerRentRecords({ month: currentMonthKey(), limit: 500 }),
    staleTime: 2 * 60 * 1000,
  });

  const properties = propertiesData?.properties ?? [];
  const tenants = (tenantsData?.tenants ?? []).filter(tn => tn.roomId?.type === 'pg');

  const paymentByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recordsData?.rentRecords ?? []) {
      const uid = typeof r.userId === 'string' ? r.userId : r.userId?._id;
      if (uid) map.set(uid, r.status);
    }
    return map;
  }, [recordsData]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter(tn => {
      if (filter === 'active' && tn.status !== 'active') return false;
      if (filter === 'pending') {
        if (tn.status !== 'active') return false;
        const st = paymentByUser.get(typeof tn.userId === 'string' ? tn.userId : tn.userId?._id);
        if (st !== 'pending' && st !== 'partial' && st !== 'overdue') return false;
      }
      if (filter === 'moving') {
        if (tn.status !== 'active' || !tn.exitDate) return false;
        if (new Date(tn.exitDate).getTime() < todayStart.getTime()) return false;
      }
      if (q) {
        const hay = `${tn.userId?.name ?? ''} ${tn.roomId?.roomNumber ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tenants, filter, query, paymentByUser, todayStart]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('pg.residents.filterAll') },
    { key: 'active', label: t('pg.residents.filterActive') },
    { key: 'pending', label: t('pg.residents.filterPending') },
    { key: 'moving', label: t('pg.residents.filterMoving') },
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
          <Text style={styles.headerTitle}>{t('pg.residents.title')}</Text>
          <Text style={styles.headerSub}>{t('pg.residents.sub')}</Text>
          <View style={styles.headerChipWrap}>
            <WorkspaceSwitcher variant="chip" />
          </View>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={() => router.push('/owner/add-tenant' as any)} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
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

        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            value={query}
            onChangeText={setQuery}
            placeholder={t('pg.residents.searchPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
          />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('pg.residents.emptyTitle')}</Text>
            <Text style={[styles.emptySub, { color: colors.text.tertiary }]}>{t('pg.residents.emptySub')}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {filtered.map(tn => {
              const st = paymentByUser.get(typeof tn.userId === 'string' ? tn.userId : tn.userId?._id);
              const isPaid = st === 'paid';
              const isPending = st === 'pending' || st === 'partial' || st === 'overdue' || !st;
              return (
                <TouchableOpacity key={tn._id} style={[styles.card, { backgroundColor: colors.surface }, shadows.sm]} onPress={() => router.push('/(pg-tabs)/residents' as any)} activeOpacity={0.75}>
                  <View style={styles.cardTop}>
                    <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>{tn.userId?.name?.charAt(0)?.toUpperCase() ?? 'R'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>{tn.userId?.name ?? 'Resident'}</Text>
                      <Text style={[styles.location, { color: colors.text.secondary }]} numberOfLines={1}>{roomLabel(tn)}</Text>
                    </View>
                    <View style={[styles.rentBadge, { backgroundColor: isPaid ? colors.successLight : colors.warningLight }]}>
                      <Text style={[styles.rentBadgeText, { color: isPaid ? colors.success : colors.warning }]}>
                        {isPaid ? t('pg.residents.paid') : t('pg.residents.pending')}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />
                  <View style={styles.cardMetaRow}>
                    <View style={styles.cardMeta}>
                      <Text style={[styles.cardMetaValue, { color: colors.text.primary }]}>{formatCurrency(tn.roomId?.monthlyRent)}</Text>
                      <Text style={[styles.cardMetaLabel, { color: colors.text.secondary }]}>{t('pg.residents.monthlyRent')}</Text>
                    </View>
                    <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.cardMeta}>
                      <Text style={[styles.cardMetaValue, { color: colors.text.primary }]}>{formatCurrency(tn.securityDeposit ?? tn.advancePaid ?? tn.roomId?.securityDeposit)}</Text>
                      <Text style={[styles.cardMetaLabel, { color: colors.text.secondary }]}>{t('pg.residents.deposit')}</Text>
                    </View>
                    <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.cardMeta}>
                      <Text style={[styles.cardMetaValue, { color: colors.text.primary }]}>{stayDays(tn.moveInDate ?? tn.joinDate)}d</Text>
                      <Text style={[styles.cardMetaLabel, { color: colors.text.secondary }]}>{t('pg.residents.stay')}</Text>
                    </View>
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
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  propertyChips: { gap: spacing.sm, paddingVertical: 2 },
  propertyChip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 14 },
  propertyChipText: { fontSize: 13, fontWeight: '600', maxWidth: 160 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  filterChip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  searchInput: { flex: 1, fontSize: 14 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 48, paddingHorizontal: spacing.huge },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  card: { borderRadius: radius.xl, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700' },
  location: { fontSize: 12, marginTop: 1 },
  rentBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.full },
  rentBadgeText: { fontSize: 11, fontWeight: '700' },
  cardDivider: { height: 1, marginVertical: spacing.md },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center' },
  cardMeta: { flex: 1, alignItems: 'center' },
  cardMetaValue: { fontSize: 14, fontWeight: '700' },
  cardMetaLabel: { fontSize: 11, marginTop: 1 },
  metaDivider: { width: 1, height: 26 },
});