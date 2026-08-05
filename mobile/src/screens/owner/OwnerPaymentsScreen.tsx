import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { appEvents, OPEN_DRAWER_EVENT } from '../../utils/events';
import {
  getOwnerRentRecords, verifyTransaction, rejectTransaction,
  getPaymentSummary, type OwnerRentRecord,
} from '../../api/owner';

// ─── Helpers ──────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

type FilterStatus = 'all' | 'pending' | 'partial' | 'overdue' | 'paid';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {};

const getStatusConfig = (status: string, colors: any) => ({
  pending: { bg: colors.warningLight, text: colors.warning, label: 'Pending' },
  partial: { bg: colors.infoLight, text: colors.info, label: 'Partial' },
  overdue: { bg: colors.errorLight, text: colors.error, label: 'Overdue' },
  paid: { bg: colors.successLight, text: colors.success, label: 'Paid' },
}[status] ?? { bg: colors.borderLight, text: colors.text.secondary, label: status });


// ─── Status badge ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { colors } = useTheme();
  const cfg = getStatusConfig(status, colors);
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── Reject reason modal ──────────────────────────────────────────────────

interface RejectModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  saving: boolean;
}

const RejectModal: React.FC<RejectModalProps> = ({ visible, onClose, onConfirm, saving }) => {
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  React.useEffect(() => { if (visible) setReason(''); }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <View style={[styles.rejectSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.rejectTitle, { color: colors.text.primary }]}>Reject Payment</Text>
          <Text style={[styles.rejectSub, { color: colors.text.secondary }]}>
            Provide a reason so the tenant knows why their proof was rejected.
          </Text>
          <TextInput
            style={[styles.rejectInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Blurry image, wrong amount…"
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: reason.trim() ? colors.error : colors.border }]}
              onPress={() => reason.trim() && onConfirm(reason.trim())}
              activeOpacity={0.8}
              disabled={saving || !reason.trim()}
            >
              {saving ? <ActivityIndicator color="#FFF" size="small" /> :
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Reject</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};


// ─── Rent record card ─────────────────────────────────────────────────────

interface RecordCardProps {
  record: OwnerRentRecord;
  onVerify: (txnId: string) => void;
  onReject: (txnId: string) => void;
  onPress: () => void;
  verifyingId: string | null;
}

const RecordCard: React.FC<RecordCardProps> = ({ record, onVerify, onReject, onPress, verifyingId }) => {
  const { colors } = useTheme();
  const hasVerifying = (record as any).transactions?.some((t: any) => t.status === 'verifying');

  return (
    <TouchableOpacity style={[styles.recordCard, { backgroundColor: colors.surface }, shadows.sm]} onPress={onPress} activeOpacity={0.85}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.text.primary }]} numberOfLines={1}>
            {record.userId.name}
          </Text>
          <Text style={[styles.cardSub, { color: colors.text.secondary }]}>
            Room {record.roomId.roomNumber} · {record.propertyId.name}
          </Text>
          <Text style={[styles.cardMonth, { color: colors.text.tertiary }]}>
            {record.month} · Due {formatDate(record.dueDate)}
          </Text>
        </View>
        <StatusBadge status={record.status} />
      </View>

      {/* Amount row */}
      <View style={[styles.amountRow, { borderTopColor: colors.borderLight }]}>
        <View style={styles.amountItem}>
          <Text style={[styles.amountValue, { color: colors.text.primary }]}>
            {formatCurrency(record.totalRent)}
          </Text>
          <Text style={[styles.amountLabel, { color: colors.text.tertiary }]}>Total</Text>
        </View>
        <View style={[styles.amountDivider, { backgroundColor: colors.border }]} />
        <View style={styles.amountItem}>
          <Text style={[styles.amountValue, { color: colors.success }]}>
            {formatCurrency(record.totalPaid)}
          </Text>
          <Text style={[styles.amountLabel, { color: colors.text.tertiary }]}>Paid</Text>
        </View>
        <View style={[styles.amountDivider, { backgroundColor: colors.border }]} />
        <View style={styles.amountItem}>
          <Text style={[styles.amountValue, { color: record.remainingAmount > 0 ? colors.error : colors.success }]}>
            {formatCurrency(record.remainingAmount)}
          </Text>
          <Text style={[styles.amountLabel, { color: colors.text.tertiary }]}>Remaining</Text>
        </View>
      </View>

      {/* Verify proof banner */}
      {hasVerifying && (
        <View style={[styles.proofBanner, { backgroundColor: colors.warningLight }]}>
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <Text style={[styles.proofBannerText, { color: colors.warning }]}>
            Payment proof awaiting verification
          </Text>
          <View style={styles.proofActions}>
            <TouchableOpacity
              style={[styles.proofBtn, { backgroundColor: colors.success }]}
              onPress={() => {
                const txn = (record as any).transactions?.find((t: any) => t.status === 'verifying');
                if (txn) onVerify(txn._id);
              }}
              activeOpacity={0.8}
            >
              {verifyingId === (record as any).transactions?.find((t: any) => t.status === 'verifying')?._id ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.proofBtnText}>Verify</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.proofBtn, { backgroundColor: colors.error }]}
              onPress={() => {
                const txn = (record as any).transactions?.find((t: any) => t.status === 'verifying');
                if (txn) onReject(txn._id);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.proofBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};


// ─── Main screen ──────────────────────────────────────────────────────────

export const OwnerPaymentsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('overdue');
  const [search, setSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);

  const queryParams = useMemo(() => ({
    status: filterStatus === 'all' ? undefined : filterStatus,
    limit: 100,
  }), [filterStatus]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerRentRecords', filterStatus],
    queryFn: () => getOwnerRentRecords(queryParams),
    staleTime: 60 * 1000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['ownerPaymentSummary'],
    queryFn: () => getPaymentSummary(),
    staleTime: 2 * 60 * 1000,
  });

  const records = data?.rentRecords ?? [];
  const metrics = summaryData?.metrics;

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r =>
      r.userId.name.toLowerCase().includes(q) ||
      r.roomId.roomNumber.toLowerCase().includes(q) ||
      r.propertyId.name.toLowerCase().includes(q) ||
      r.month.includes(q)
    );
  }, [records, search]);

  const verifyMutation = useMutation({
    mutationFn: verifyTransaction,
    onMutate: (id) => setVerifyingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      setVerifyingId(null);
      Alert.alert('Verified', 'Payment has been verified and credited.');
    },
    onError: (err: any) => {
      setVerifyingId(null);
      Alert.alert('Error', err?.message || 'Verification failed.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTransaction(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      setRejectModalVisible(false);
      setRejectTargetId(null);
      Alert.alert('Rejected', 'Payment proof has been rejected. Tenant will be notified.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Rejection failed.'),
  });

  const handleVerify = (txnId: string) => {
    Alert.alert('Verify Payment', 'Confirm this payment proof and credit it to the tenant?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Verify', onPress: () => verifyMutation.mutate(txnId) },
    ]);
  };

  const handleRejectTap = (txnId: string) => {
    setRejectTargetId(txnId);
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = (reason: string) => {
    if (!rejectTargetId) return;
    rejectMutation.mutate({ id: rejectTargetId, reason });
  };

  const tabs: { key: FilterStatus; label: string; count?: number }[] = [
    { key: 'overdue', label: 'Overdue', count: metrics?.overdueCount },
    { key: 'pending', label: 'Pending', count: metrics?.pendingCount },
    { key: 'partial', label: 'Partial', count: metrics?.partialCount },
    { key: 'paid', label: 'Paid', count: metrics?.paidCount },
    { key: 'all', label: 'All' },
  ];


  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Payments</Text>
          {metrics && (
            <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
              Collected ₹{(metrics.collectionsToday ?? 0).toLocaleString('en-IN')} today
            </Text>
          )}
        </View>
      </View>

      {/* Summary strip */}
      {metrics && (
        <View style={[styles.summaryStrip, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.stripItem}>
            <Text style={[styles.stripValue, { color: colors.error }]}>
              {formatCurrency(metrics.totalOverdue)}
            </Text>
            <Text style={[styles.stripLabel, { color: colors.text.tertiary }]}>Overdue</Text>
          </View>
          <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stripItem}>
            <Text style={[styles.stripValue, { color: colors.warning }]}>
              {formatCurrency(metrics.totalPending)}
            </Text>
            <Text style={[styles.stripLabel, { color: colors.text.tertiary }]}>Pending</Text>
          </View>
          <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stripItem}>
            <Text style={[styles.stripValue, { color: colors.success }]}>
              {formatCurrency(metrics.totalCollected)}
            </Text>
            <Text style={[styles.stripLabel, { color: colors.text.tertiary }]}>Collected</Text>
          </View>
        </View>
      )}

      {/* Status filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabScroll, { borderBottomColor: colors.border }]} contentContainerStyle={styles.tabContent}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, filterStatus === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilterStatus(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: filterStatus === t.key ? colors.primary : colors.text.secondary }]}>
              {t.label}{t.count != null ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by tenant, room, month…"
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
          <Ionicons name="wallet-outline" size={48} color={colors.text.tertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
            {search ? 'No results found' : `No ${filterStatus === 'all' ? '' : filterStatus} records`}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {filtered.map(r => (
            <RecordCard
              key={r._id}
              record={r}
              onVerify={handleVerify}
              onReject={handleRejectTap}
              onPress={() => router.push({ pathname: '/owner/transactions/[rentRecordId]', params: { rentRecordId: r._id } } as any)}
              verifyingId={verifyingId}
            />
          ))}
        </ScrollView>
      )}

      <RejectModal
        visible={rejectModalVisible}
        onClose={() => { setRejectModalVisible(false); setRejectTargetId(null); }}
        onConfirm={handleRejectConfirm}
        saving={rejectMutation.isPending}
      />
    </View>
  );
};


// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },

  summaryStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stripItem: { flex: 1, alignItems: 'center' },
  stripValue: { fontSize: 15, fontWeight: '700' },
  stripLabel: { fontSize: 11, marginTop: 2 },
  stripDivider: { width: 1, height: 28 },

  tabScroll: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabContent: { paddingHorizontal: spacing.xl },
  tab: { paddingVertical: spacing.md, marginRight: spacing.xl, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },

  searchWrap: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14 },

  scroll: { padding: spacing.xl, gap: spacing.md },

  recordCard: { borderRadius: radius.xl, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.lg, gap: spacing.md },
  cardName: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 2 },
  cardMonth: { fontSize: 11, marginTop: 3 },

  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md,
  },
  amountItem: { flex: 1, alignItems: 'center' },
  amountValue: { fontSize: 14, fontWeight: '700' },
  amountLabel: { fontSize: 10, marginTop: 2 },
  amountDivider: { width: 1, height: 24 },

  proofBanner: {
    padding: spacing.md, gap: spacing.sm,
  },
  proofBannerText: { fontSize: 13, fontWeight: '500' },
  proofActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  proofBtn: {
    flex: 1, height: 38, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  proofBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },

  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', padding: spacing.xl,
  },
  rejectSheet: { width: '100%', borderRadius: radius.xxl, padding: spacing.xxl },
  rejectTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  rejectSub: { fontSize: 13, marginBottom: spacing.xl, lineHeight: 19 },
  rejectInput: {
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: 14, height: 80, textAlignVertical: 'top', paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalBtn: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
});
