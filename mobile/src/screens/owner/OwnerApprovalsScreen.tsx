import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { getPendingApprovals, verifyTransaction, rejectTransaction, type OwnerTransaction } from '../../api/owner';

const formatCurrency = (n?: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const OwnerApprovalsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [rejectTarget, setRejectTarget] = useState<OwnerTransaction | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerPendingApprovals'],
    queryFn: getPendingApprovals,
    staleTime: 30 * 1000,
  });

  const transactions = data?.transactions ?? [];

  const verifyMutation = useMutation({
    mutationFn: verifyTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerPendingApprovals'] });
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.approvals.errVerify')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTransaction(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerPendingApprovals'] });
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.approvals.errReject')),
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('owner.approvals.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
            {t(transactions.length === 1 ? 'owner.approvals.count_one' : 'owner.approvals.count_other', { count: transactions.length })}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle-outline" size={52} color={colors.success} />
          <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('owner.approvals.allCaughtTitle')}</Text>
          <Text style={[styles.emptySub, { color: colors.text.tertiary }]}>{t('owner.approvals.allCaughtSub')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {transactions.map(txn => (
            <View key={txn._id} style={[styles.card, { backgroundColor: colors.surface }, shadows.sm]}>
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="time-outline" size={20} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.amount, { color: colors.text.primary }]}>{formatCurrency(txn.amount)}</Text>
                  <Text style={[styles.meta, { color: colors.text.secondary }]}>
                    {txn.paymentMethod} · {txn.rentRecordId?.month ?? ''} · {formatDate(txn.paymentDate || txn.createdAt)}
                  </Text>
                  {txn.tenantId?.userId?.name ? <Text style={[styles.meta, { color: colors.text.secondary }]}>{txn.tenantId.userId.name}{txn.tenantId.roomId?.roomNumber ? ` · Room ${txn.tenantId.roomId.roomNumber}` : ''}</Text> : null}
                </View>
              </View>
              {txn.proofImage?.secureUrl && (
                <View style={styles.proofWrap}>
                  <Image source={{ uri: txn.proofImage.secureUrl }} style={styles.proofImage} resizeMode="cover" />
                </View>
              )}
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => verifyMutation.mutate(txn._id)} disabled={verifyMutation.isPending} activeOpacity={0.8}>
                  {verifyMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnText}>{t('owner.approvals.btnApprove')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.error }]} onPress={() => setRejectTarget(txn)} activeOpacity={0.8}>
                  <Text style={styles.btnText}>{t('owner.approvals.btnReject')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!rejectTarget} animationType="fade" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.rejectSheet, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <Text style={[styles.rejectTitle, { color: colors.text.primary }]}>{t('owner.approvals.rejectTitle')}</Text>
            <Text style={[styles.rejectSub, { color: colors.text.secondary }]}>{t('owner.approvals.rejectSub')}</Text>
            <TextInput
              style={[styles.rejectInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t('owner.approvals.rejectPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]} onPress={() => { setRejectTarget(null); setRejectReason(''); }} activeOpacity={0.7}>
                 <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.approvals.btnCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: rejectReason.trim() && !rejectMutation.isPending ? colors.error : colors.border }]}
                onPress={() => rejectTarget && rejectReason.trim() && rejectMutation.mutate({ id: rejectTarget._id, reason: rejectReason.trim() })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                activeOpacity={0.8}
              >
                {rejectMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> :                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>{t('owner.approvals.btnReject')}</Text>}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.huge },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: spacing.sm },
  emptySub: { fontSize: 13, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.md },
  card: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  amount: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  proofLink: { fontSize: 13, fontWeight: '600' },
  proofWrap: { borderRadius: radius.md, overflow: 'hidden' },
  proofImage: { width: '100%', height: 160, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: spacing.xl },
  rejectSheet: { width: '100%', maxHeight: '90%', borderRadius: radius.xxl, padding: spacing.xxl },
  rejectTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  rejectSub: { fontSize: 13, marginBottom: spacing.xl, lineHeight: 19 },
  rejectInput: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, height: 80, textAlignVertical: 'top', paddingTop: spacing.sm, marginBottom: spacing.lg },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalBtn: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});