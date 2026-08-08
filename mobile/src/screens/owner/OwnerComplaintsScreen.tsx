import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { getComplaints, type OwnerComplaint } from '../../api/owner';

const STATUS_CFG = (colors: any, t: any) => ({
  pending: { bg: colors.warningLight, text: colors.warning, label: t('owner.complaints.statusOpen') },
  'in-progress': { bg: colors.infoLight, text: colors.info, label: t('owner.complaints.statusInProgress') },
  resolved: { bg: colors.successLight, text: colors.success, label: t('owner.complaints.statusResolved') },
  rejected: { bg: colors.errorLight, text: colors.error, label: t('owner.complaints.statusRejected') },
  closed: { bg: colors.borderLight, text: colors.text.secondary, label: t('owner.complaints.statusClosed') },
});

const PRIORITY_CFG = (colors: any, t: any) => ({
  low: { bg: colors.successLight, text: colors.success, label: t('owner.complaints.priorityLow') },
  medium: { bg: colors.infoLight, text: colors.info, label: t('owner.complaints.priorityMedium') },
  high: { bg: colors.warningLight, text: colors.warning, label: t('owner.complaints.priorityHigh') },
  urgent: { bg: colors.errorLight, text: colors.error, label: t('owner.complaints.priorityUrgent') },
});

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

type FilterTab = 'all' | 'pending' | 'in-progress' | 'resolved';

const ComplaintCard: React.FC<{ complaint: OwnerComplaint; onPress: () => void; t: (key: string) => string }> = ({ complaint, onPress, t }) => {
  const { colors } = useTheme();
  const sc = STATUS_CFG(colors, t)[complaint.status] ?? { bg: colors.borderLight, text: colors.text.secondary, label: complaint.status };
  const pc = PRIORITY_CFG(colors, t)[complaint.priority] ?? { bg: colors.borderLight, text: colors.text.secondary, label: complaint.priority };
  const location = [complaint.roomId?.roomNumber ? `Room ${complaint.roomId.roomNumber}` : null, complaint.propertyId?.name].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }, shadows.sm]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="construct-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]} numberOfLines={2}>{complaint.title}</Text>
          <Text style={[styles.cardSub, { color: colors.text.secondary }]} numberOfLines={1}>
            {complaint.tenantId?.userId?.name ? `${complaint.tenantId.userId.name} · ` : ''}{location || t('owner.complaints.noLocation')}
          </Text>
          <Text style={[styles.cardDate, { color: colors.text.tertiary }]}>{formatDate(complaint.createdAt)}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{sc.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: pc.bg }]}>
            <Text style={[styles.badgeText, { color: pc.text }]}>{pc.label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const OwnerComplaintsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerComplaints'],
    queryFn: getComplaints,
    staleTime: 60 * 1000,
  });

  const complaints = data?.complaints ?? [];

  const filtered = useMemo(() => {
    let list = complaints;
    if (filter !== 'all') list = list.filter(c => c.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.tenantId?.userId?.name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [complaints, filter, search]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('owner.complaints.tabAll') },
    { key: 'pending', label: t('owner.complaints.tabOpen') },
    { key: 'in-progress', label: t('owner.complaints.tabInProgress') },
    { key: 'resolved', label: t('owner.complaints.tabResolved') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.complaints.title')}</Text>
          {!isLoading && (
            <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
              {t(filtered.length === 1 ? 'owner.complaints.count_one' : 'owner.complaints.count_other', { count: filtered.length })}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, filter === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: filter === t.key ? colors.primary : colors.text.secondary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t('owner.complaints.searchPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="construct-outline" size={48} color={colors.text.tertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
            {search ? t('owner.complaints.emptyNoSearch') : t('owner.complaints.emptyDefault')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {filtered.map(c => (
            <ComplaintCard
              key={c._id}
              complaint={c}
              onPress={() => router.push({ pathname: '/owner/complaints/[id]', params: { id: c._id } } as any)}
              t={t}
            />
          ))}
        </ScrollView>
      )}
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
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: spacing.md, marginRight: spacing.xl, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },
  searchWrap: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14 },
  scroll: { padding: spacing.xl, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
  card: { borderRadius: radius.xl, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardIconWrap: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 2 },
  cardDate: { fontSize: 11, marginTop: 3 },
  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
});