import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import { WorkspaceSwitcher } from '../../components/WorkspaceSwitcher';
import {
  getPaymentSummary,
  getProperties,
  getOwnerTenants,
  getRooms,
  type PaymentSummaryMetrics,
} from '../../api/owner';

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

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
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const firstName = user?.name?.split(' ')[0] ?? 'Owner';

  // ── Data fetching ──────────────────────────────────────────────────────
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

  const isLoading = loadingSummary || loadingProperties || loadingTenants || loadingRooms;

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchSummary(), refetchProperties(), refetchTenants(), refetchRooms()]);
  }, [refetchSummary, refetchProperties, refetchTenants, refetchRooms]);

  // ── Derived values ─────────────────────────────────────────────────────
  const metrics: PaymentSummaryMetrics | undefined = summaryData?.metrics;
  const properties = propertiesData?.properties ?? [];
  const activeTenants = tenantsData?.count ?? 0;
  const rooms = roomsData?.rooms ?? [];
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.currentOccupancy > 0).length;
  const occupancyPct =
    totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
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
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>Welcome back, {firstName}</Text>
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
        {/* ── Collection summary card ── */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadows.md]}>
          <Text style={[styles.summaryCardTitle, { color: colors.text.secondary }]}>
            Total Collected
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
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>Today</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.warning }]}>
                {formatCurrency(metrics?.totalOverdue ?? 0)}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>Overdue</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemValue, { color: colors.text.secondary }]}>
                {formatCurrency(metrics?.totalOutstanding ?? 0)}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: colors.text.secondary }]}>Outstanding</Text>
            </View>
          </View>
        </View>

        {/* ── Stats grid ── */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="business-outline"
            label="Properties"
            value={loadingProperties ? '…' : String(properties.length)}
            accent="#2563EB"
            onPress={() => onNavigate('properties')}
          />
          <StatCard
            icon="bed-outline"
            label="Rooms"
            value={loadingRooms ? '…' : String(totalRooms)}
            accent="#7C3AED"
            onPress={() => onNavigate('properties')}
          />
          <StatCard
            icon="people-outline"
            label="Active Tenants"
            value={loadingTenants ? '…' : String(activeTenants)}
            accent="#059669"
            onPress={() => onNavigate('tenants')}
          />
          <StatCard
            icon="trending-up-outline"
            label="Occupancy"
            value={loadingRooms ? '…' : `${occupancyPct}%`}
            accent="#D97706"
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="Paid Bills"
            value={loadingSummary ? '…' : String(metrics?.paidCount ?? 0)}
            accent="#16A34A"
            onPress={() => onNavigate('payments')}
          />
          <StatCard
            icon="alert-circle-outline"
            label="Overdue Bills"
            value={loadingSummary ? '…' : String(metrics?.overdueCount ?? 0)}
            accent="#DC2626"
            onPress={() => onNavigate('payments')}
          />
        </View>

        {/* ── Payment breakdown card ── */}
        <View style={[styles.breakdownCard, { backgroundColor: colors.surface }, shadows.sm]}>
          <Text style={[styles.breakdownTitle, { color: colors.text.primary }]}>
            Payment Breakdown
          </Text>
          {loadingSummary ? (
            <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />
          ) : (
            <>
              <SectionRow
                label="Pending bills"
                value={String(metrics?.pendingCount ?? 0)}
                valueColor={colors.warning}
              />
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <SectionRow
                label="Partial payments"
                value={String(metrics?.partialCount ?? 0)}
                valueColor={colors.info}
              />
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <SectionRow
                label="Overdue bills"
                value={String(metrics?.overdueCount ?? 0)}
                valueColor={colors.error}
              />
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <SectionRow
                label="Total outstanding"
                value={formatCurrency(metrics?.totalOutstanding ?? 0)}
                valueColor={colors.error}
              />
            </>
          )}
        </View>

        {/* ── Properties quick list ── */}
        {properties.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Properties</Text>
              <TouchableOpacity onPress={() => onNavigate('properties')} activeOpacity={0.7}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
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
              Could not load stats. Pull down to retry.
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
