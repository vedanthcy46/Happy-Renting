import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getBillDetail, waiveBillItem, publishBill, deleteBill, MonthlyBill, BillItem } from '../../api/billing';
import { spacing, radius, shadows } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { AppButton, KeyboardSafeBottomSheet } from '../../components';

const formatCurrency = (n: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatMonth = (m: string) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  DRAFT:   { color: '#64748B', bg: '#F1F5F9' },
  PENDING: { color: '#D97706', bg: '#FEF3C7' },
  PARTIAL: { color: '#2563EB', bg: '#DBEAFE' },
  PAID:    { color: '#16A34A', bg: '#DCFCE7' },
  OVERDUE: { color: '#DC2626', bg: '#FEE2E2' },
  WAIVED:  { color: '#7C3AED', bg: '#EDE9FE' },
};

interface BillDetailScreenProps {
  billId: string;
}

export const BillDetailScreen: React.FC<BillDetailScreenProps> = ({ billId }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [waiveItem, setWaiveItem] = useState<BillItem | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waivePartialAmt, setWaivePartialAmt] = useState('');
  const [waiveMode, setWaiveMode] = useState<'full' | 'partial'>('full');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['billDetail', billId],
    queryFn: () => getBillDetail(billId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const mutationWaive = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: any }) =>
      waiveBillItem(billId, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billDetail', billId] });
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      setWaiveItem(null);
      setWaiveReason('');
      setWaivePartialAmt('');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to waive item'),
  });

  const mutationPublish = useMutation({
    mutationFn: () => publishBill(billId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billDetail', billId] });
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      Alert.alert('✓ Bill Published', 'Tenant has been notified.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to publish bill'),
  });

  const mutationDelete = useMutation({
    mutationFn: () => deleteBill(billId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerBills'] });
      Alert.alert('Deleted', 'Draft bill has been deleted.');
      router.back();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to delete bill'),
  });

  const handleWaiveSubmit = () => {
    if (!waiveItem) return;
    const payload: any = { waiverReason: waiveReason || undefined };
    if (waiveMode === 'partial') {
      const amt = Number(waivePartialAmt);
      if (isNaN(amt) || amt <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
      payload.waivedAmount = amt;
    }
    mutationWaive.mutate({ itemId: waiveItem._id, payload });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const bill = data?.bill;
  if (!bill) return null;

  const rr = bill.rentRecordId as any;
  const statusCfg = STATUS_COLOR[bill.status] ?? STATUS_COLOR.PENDING;
  const paid = rr?.totalPaid ?? 0;
  const remaining = rr?.remainingAmount ?? bill.totalAmount;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text.primary }]}>{formatMonth(bill.month)}</Text>
        <View style={{ flexDirection: 'row' }}>
          {bill.status === 'DRAFT' && (
            <TouchableOpacity 
              onPress={() => Alert.alert('Delete Bill', 'Are you sure you want to delete this draft bill?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => mutationDelete.mutate() }
              ])} 
              style={[styles.backBtn, { marginRight: 8 }]}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => refetch()} style={styles.backBtn}>
            <Ionicons name="refresh" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, bill.status === 'DRAFT' && { paddingBottom: spacing.lg }]} showsVerticalScrollIndicator={false}>
        {/* Summary header */}
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryTenant}>{(bill.userId as any)?.name ?? 'Tenant'}</Text>
              <Text style={styles.summaryRoom}>Room {(bill.roomId as any)?.roomNumber}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{bill.status}</Text>
            </View>
          </View>
          <Text style={styles.summaryAmount}>{formatCurrency(bill.totalAmount)}</Text>
          {paid > 0 && (
            <View style={styles.paidRow}>
              <Text style={styles.paidLabel}>Paid {formatCurrency(paid)}</Text>
              <Text style={styles.remainingLabel}>Remaining {formatCurrency(remaining)}</Text>
            </View>
          )}
          <Text style={styles.dueDateLabel}>
            Due: {new Date(bill.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        {/* Line items */}
        <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>BILL BREAKDOWN</Text>
        <View style={[styles.itemsCard, { backgroundColor: colors.surface }, shadows.sm]}>
          {bill.items.map((item, idx) => (
            <View key={item._id} style={[styles.lineItem,
              idx < bill.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lineDesc, { color: colors.text.primary }]}>{item.description}</Text>
                {item.metadata?.unitsConsumed != null && (
                  <Text style={[styles.lineMeta, { color: colors.text.tertiary }]}>
                    {item.metadata.unitsConsumed} units × ₹{item.metadata.ratePerUnit}
                  </Text>
                )}
                {item.isWaived && (
                  <Text style={[styles.waivedTag, { color: colors.success }]}>✓ Waived</Text>
                )}
                {!item.isWaived && item.waivedAmount > 0 && (
                  <Text style={[styles.waivedTag, { color: colors.warning }]}>
                    Partial waiver: {formatCurrency(item.waivedAmount)}
                  </Text>
                )}
              </View>
              <View style={styles.lineRight}>
                {item.isWaived ? (
                  <Text style={[styles.lineAmt, { color: colors.text.tertiary, textDecorationLine: 'line-through' }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                ) : (
                  <Text style={[styles.lineAmt, { color: colors.text.primary }]}>
                    {formatCurrency(item.effectiveAmount)}
                  </Text>
                )}
                {/* Waive button — only for non-RENT, non-fully-waived items on unpaid bills */}
                {item.type !== 'RENT' && !item.isWaived && !['PAID', 'WAIVED'].includes(bill.status) && (
                  <TouchableOpacity
                    style={[styles.waiveBtn, { borderColor: colors.border }]}
                    onPress={() => { setWaiveItem(item); setWaiveMode('full'); setWaiveReason(''); setWaivePartialAmt(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.waiveBtnText, { color: colors.text.secondary }]}>Waive</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text.primary }]}>Total Due</Text>
            <Text style={[styles.totalAmt, { color: colors.primary }]}>{formatCurrency(bill.totalAmount)}</Text>
          </View>
        </View>

        {/* Payment info if linked */}
        {rr && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>PAYMENT STATUS</Text>
            <View style={[styles.payCard, { backgroundColor: colors.surface }, shadows.sm]}>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.text.secondary }]}>Total Bill</Text>
                <Text style={[styles.payValue, { color: colors.text.primary }]}>{formatCurrency(bill.totalAmount)}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.text.secondary }]}>Paid</Text>
                <Text style={[styles.payValue, { color: colors.success }]}>{formatCurrency(paid)}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.text.secondary }]}>Remaining</Text>
                <Text style={[styles.payValue, { color: remaining > 0 ? colors.error : colors.success }]}>
                  {formatCurrency(remaining)}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Draft action bar */}
      {bill.status === 'DRAFT' && (
        <View style={[styles.draftBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton
            title="Edit Bill"
            variant="outline"
            onPress={() => router.push(`/owner/billing/create?billId=${bill._id}`)}
            fullWidth
          />
          <AppButton
            title="Publish Bill"
            onPress={() => mutationPublish.mutate()}
            loading={mutationPublish.isPending}
            fullWidth
          />
        </View>
      )}

      {/* Waive item bottom sheet */}
      <KeyboardSafeBottomSheet
        visible={!!waiveItem}
        onClose={() => setWaiveItem(null)}
        title="Waive Charge"
      >
          {waiveItem && (
            <View style={[styles.waiveInfoBox, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.waiveInfoText, { color: colors.text.secondary }]}>
                {waiveItem.description} — {formatCurrency(waiveItem.amount)}
              </Text>
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>WAIVE MODE</Text>
          <View style={styles.chipRow}>
            {(['full', 'partial'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background },
                  waiveMode === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setWaiveMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: colors.text.secondary },
                  waiveMode === m && { color: '#FFF' }]}>
                  {m === 'full' ? 'Full Waiver' : 'Partial Waiver'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {waiveMode === 'partial' && (
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.inputPrefix, { color: colors.text.secondary }]}>₹</Text>
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="Amount to waive"
                placeholderTextColor={colors.text.tertiary}
                value={waivePartialAmt}
                onChangeText={setWaivePartialAmt}
                keyboardType="numeric"
              />
            </View>
          )}

          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background, marginTop: spacing.md }]}>
            <TextInput
              style={[styles.input, { color: colors.text.primary }]}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={waiveReason}
              onChangeText={setWaiveReason}
            />
          </View>

          <View style={styles.formBtns}>
            <AppButton title="Cancel" onPress={() => setWaiveItem(null)} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
            <AppButton
              title="Confirm Waiver"
              onPress={handleWaiveSubmit}
              loading={mutationWaive.isPending}
              style={{ flex: 1, marginLeft: spacing.sm, backgroundColor: colors.success }}
            />
          </View>
      </KeyboardSafeBottomSheet>
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.background },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '600' },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.huge + 40 },
  summaryCard: { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xl },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  summaryTenant: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  summaryRoom: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  summaryAmount: { fontSize: 36, fontWeight: '700', color: '#FFF', letterSpacing: -1, marginBottom: spacing.sm },
  paidRow: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.xs },
  paidLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  remainingLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  dueDateLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
  itemsCard: { borderRadius: radius.lg, overflow: 'hidden' },
  lineItem: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: spacing.lg },
  lineDesc: { fontSize: 14, fontWeight: '500' },
  lineMeta: { fontSize: 12, marginTop: 2 },
  waivedTag: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  lineRight: { alignItems: 'flex-end', gap: spacing.xs },
  lineAmt: { fontSize: 15, fontWeight: '600' },
  waiveBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1 },
  waiveBtnText: { fontSize: 12, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1 },
  totalLabel: { fontSize: 15, fontWeight: '700' },
  totalAmt: { fontSize: 18, fontWeight: '700' },
  payCard: { borderRadius: radius.lg, padding: spacing.lg },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  payLabel: { fontSize: 14 },
  payValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1 },
  waiveInfoBox: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xl },
  waiveInfoText: { fontSize: 14, fontWeight: '500' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  inputPrefix: { fontSize: 16, fontWeight: '600', marginRight: spacing.xs },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  draftBar: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.md },
  formBtns: { flexDirection: 'row', marginTop: spacing.xl },
});
