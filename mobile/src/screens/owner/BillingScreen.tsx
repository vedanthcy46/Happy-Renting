import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getBills, MonthlyBill, BillStatus, bulkPublishBills, bulkDeleteBills } from '../../api/billing';
import { spacing, radius, shadows } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components';

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatMonth = (m: string) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const STATUS_CONFIG: Record<BillStatus, { color: string; bg: string; label: string; dot: string }> = {
  DRAFT:    { color: '#64748B', bg: '#F1F5F9', label: 'Draft',    dot: '⚪' },
  PENDING:  { color: '#D97706', bg: '#FEF3C7', label: 'Pending',  dot: '🔴' },
  PARTIAL:  { color: '#2563EB', bg: '#DBEAFE', label: 'Partial',  dot: '🟡' },
  PAID:     { color: '#16A34A', bg: '#DCFCE7', label: 'Paid',     dot: '🟢' },
  OVERDUE:  { color: '#DC2626', bg: '#FEE2E2', label: 'Overdue',  dot: '🔴' },
  WAIVED:   { color: '#7C3AED', bg: '#EDE9FE', label: 'Waived',   dot: '🟣' },
};

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthOptions = () => {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ label: formatMonth(val), value: val });
  }
  return opts;
};

interface BillingScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ onNavigate }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerBills', selectedMonth],
    queryFn: () => getBills({ month: selectedMonth, limit: 100 }),
    staleTime: 60 * 1000,
  });

  const bills = data?.bills ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return bills;
    const q = search.toLowerCase();
    return bills.filter(b => {
      const user = b.userId as any;
      const room = b.roomId as any;
      return (
        user?.name?.toLowerCase().includes(q) ||
        room?.roomNumber?.toLowerCase().includes(q)
      );
    });
  }, [bills, search]);

  // Summary stats
  const queryClient = useQueryClient();

  const draftBills = useMemo(() => bills.filter(b => b.status === 'DRAFT'), [bills]);

  React.useEffect(() => {
    if (draftBills.length === 0) {
      setSelectionMode(false);
      setSelectedDraftIds([]);
    }
  }, [draftBills.length]);

  const mutationBulkPublish = useMutation({
    mutationFn: (ids: string[]) => bulkPublishBills(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      Alert.alert('Success', `${data.publishedIds.length} bills published successfully.`);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to publish bills'),
  });

  const mutationBulkDelete = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteBills(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      Alert.alert('Success', 'Draft bills deleted.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to delete bills'),
  });

  const handleBulkPublish = (ids: string[], isAll: boolean) => {
    if (ids.length === 0) return;
    Alert.alert(
      isAll ? 'Publish All Drafts' : 'Publish Selected',
      `Are you sure you want to publish ${ids.length} draft bills? Tenants will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', style: 'default', onPress: () => { mutationBulkPublish.mutate(ids); setSelectionMode(false); setSelectedDraftIds([]); } }
      ]
    );
  };

  const handleBulkDelete = (ids: string[], isAll: boolean) => {
    if (ids.length === 0) return;
    Alert.alert(
      isAll ? 'Delete All Drafts' : 'Delete Selected',
      `Are you sure you want to delete ${ids.length} draft bills? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { mutationBulkDelete.mutate(ids); setSelectionMode(false); setSelectedDraftIds([]); } }
      ]
    );
  };

  const stats = useMemo(() => {
    const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0);
    const collected = bills
      .filter(b => b.rentRecordId)
      .reduce((s, b) => {
        const rr = b.rentRecordId as any;
        return s + (rr?.totalPaid ?? 0);
      }, 0);
    const pending = totalBilled - collected;
    const paidCount = bills.filter(b => b.status === 'PAID').length;
    const pendingCount = bills.filter(b => ['PENDING', 'OVERDUE'].includes(b.status)).length;
    const partialCount = bills.filter(b => b.status === 'PARTIAL').length;
    return { totalBilled, collected, pending, paidCount, pendingCount, partialCount };
  }, [bills]);

  const months = useMemo(() => monthOptions(), []);

  const renderBillRow = useCallback(({ item }: { item: MonthlyBill }) => {
    const user = item.userId as any;
    const room = item.roomId as any;
    const rr = item.rentRecordId as any;
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
    const paid = rr?.totalPaid ?? 0;
    const remaining = rr?.remainingAmount ?? item.totalAmount;
    
    const isSelected = selectedDraftIds.includes(item._id);

    return (
      <TouchableOpacity
        style={[styles.billRow, { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : 'transparent', borderWidth: isSelected ? 1 : 0 }, shadows.sm]}
        onPress={() => {
          if (selectionMode && item.status === 'DRAFT') {
            setSelectedDraftIds(prev => prev.includes(item._id) ? prev.filter(id => id !== item._id) : [...prev, item._id]);
          } else {
            router.navigate(`/owner/billing/${item._id}` as any);
          }
        }}
        activeOpacity={0.75}
      >
        <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
          {selectionMode && item.status === 'DRAFT' && (
            <View style={{ marginRight: 12 }}>
              <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? colors.primary : colors.text.tertiary} />
            </View>
          )}
          <View style={styles.billRowLeft}>
            <Text style={[styles.billTenantName, { color: colors.text.primary }]} numberOfLines={1}>
              {user?.name ?? 'Tenant'}
            </Text>
            <Text style={[styles.billRoomLabel, { color: colors.text.secondary }]}>
              Room {room?.roomNumber ?? '—'}
            </Text>
            {item.status !== 'DRAFT' && paid > 0 && (
              <Text style={[styles.billPaidLabel, { color: colors.success }]}>
                Paid {formatCurrency(paid)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.billRowRight}>
          <Text style={[styles.billAmount, { color: colors.text.primary }]}>
            {formatCurrency(item.totalAmount)}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusChipText, { color: cfg.color }]}>
              {cfg.dot} {cfg.label}
            </Text>
          </View>
          {item.status === 'DRAFT' && (
            <Text style={[styles.draftNote, { color: colors.text.tertiary }]}>Not sent</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [colors, router, styles, selectionMode, selectedDraftIds]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Billing</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.navigate('/owner/billing/create' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>New Bill</Text>
          </TouchableOpacity>
        </View>

        {/* Month picker */}
        <TouchableOpacity
          style={[styles.monthPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowMonthPicker(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={[styles.monthPickerText, { color: colors.text.primary }]}>
            {formatMonth(selectedMonth)}
          </Text>
          <Ionicons name={showMonthPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.tertiary} />
        </TouchableOpacity>

        {showMonthPicker && (
          <View style={[styles.monthDropdown, { backgroundColor: colors.surface }, shadows.md]}>
            {months.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[styles.monthOption, selectedMonth === m.value && { backgroundColor: colors.primaryLight }]}
                onPress={() => { setSelectedMonth(m.value); setShowMonthPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.monthOptionText, { color: selectedMonth === m.value ? colors.primary : colors.text.primary }]}>
                  {m.label}
                </Text>
                {selectedMonth === m.value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlashList<MonthlyBill>
        data={filtered}
        keyExtractor={item => item._id}
        estimatedItemSize={80}
        renderItem={renderBillRow}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Summary card */}
            {bills.length > 0 && (
              <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadows.md]}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.text.primary }]}>{formatCurrency(stats.totalBilled)}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>Total Billed</Text>
                  </View>
                  <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(stats.collected)}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>Collected</Text>
                  </View>
                  <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(stats.pending)}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>Pending</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                <View style={styles.statusRow}>
                  <Text style={[styles.statusStat, { color: colors.error }]}>🔴 {stats.pendingCount} Pending</Text>
                  <Text style={[styles.statusStat, { color: colors.success }]}>🟢 {stats.paidCount} Paid</Text>
                  <Text style={[styles.statusStat, { color: colors.info }]}>🟡 {stats.partialCount} Partial</Text>
                </View>
              </View>
            )}

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text.primary }]}
                placeholder="Search tenant or room..."
                placeholderTextColor={colors.text.tertiary}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Bulk Actions */}
            {draftBills.length > 0 && !search && (
              <View style={[styles.bulkActionBar, { backgroundColor: selectionMode ? colors.primaryLight : colors.surface, borderColor: selectionMode ? colors.primary : colors.border, borderWidth: 1 }]}>
                {selectionMode ? (
                  <>
                    <Text style={[styles.bulkActionText, { color: colors.primary }]}>
                      {selectedDraftIds.length} Selected
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: 'transparent' }]}
                        onPress={() => { setSelectionMode(false); setSelectedDraftIds([]); }}
                      >
                        <Text style={[styles.bulkBtnText, { color: colors.text.secondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      {selectedDraftIds.length > 0 && (
                        <>
                          <TouchableOpacity 
                            style={[styles.bulkBtn, { backgroundColor: colors.error }]}
                            onPress={() => handleBulkDelete(selectedDraftIds, false)}
                          >
                            <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Delete</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.bulkBtn, { backgroundColor: colors.primary }]}
                            onPress={() => handleBulkPublish(selectedDraftIds, false)}
                          >
                            <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Publish</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.bulkActionText, { color: colors.text.primary }]}>
                      {draftBills.length} Draft{draftBills.length > 1 ? 's' : ''} Ready
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => setSelectionMode(true)}
                      >
                        <Text style={[styles.bulkBtnText, { color: colors.text.primary }]}>Select</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.bulkBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleBulkPublish(draftBills.map(b => b._id), true)}
                      >
                        <Text style={[styles.bulkBtnText, { color: '#FFF' }]}>Publish All</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.huge }} />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No bills yet"
              description={`No bills for ${formatMonth(selectedMonth)}. Tap + New Bill to create one.`}
            />
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  headerTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.full },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1 },
  monthPickerText: { flex: 1, fontSize: 15, fontWeight: '600' },
  monthDropdown: { position: 'absolute', top: '100%', left: spacing.xl, right: spacing.xl, borderRadius: radius.lg, zIndex: 100, overflow: 'hidden', marginTop: spacing.xs },
  monthOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  monthOptionText: { fontSize: 15, fontWeight: '500' },
  listHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  summaryCard: { borderRadius: radius.xl, padding: spacing.xl },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36 },
  divider: { height: 1, marginVertical: spacing.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statusStat: { fontSize: 13, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  bulkActionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginTop: 12 },
  bulkActionText: { fontSize: 14, fontWeight: '700' },
  bulkBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  bulkBtnText: { fontSize: 13, fontWeight: '700' },
  listContent: { paddingBottom: spacing.huge + 40 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radius.lg, padding: spacing.lg, marginHorizontal: spacing.lg, marginTop: spacing.md },
  billRowLeft: { flex: 1, gap: 2 },
  billTenantName: { fontSize: 15, fontWeight: '600' },
  billRoomLabel: { fontSize: 13 },
  billPaidLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  billRowRight: { alignItems: 'flex-end', gap: spacing.xs },
  billAmount: { fontSize: 16, fontWeight: '700' },
  statusChip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.full },
  statusChipText: { fontSize: 12, fontWeight: '600' },
  draftNote: { fontSize: 11 },
});
