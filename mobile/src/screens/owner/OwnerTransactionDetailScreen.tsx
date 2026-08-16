import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { ImageLightbox, KeyboardSafeModal, CalendarPicker } from '../../components';
import { getPaymentDetail, reverseTransaction, addTransaction, verifyTransaction, rejectTransaction, type OwnerTransaction } from '../../api/owner';

const formatCurrency = (n?: number) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TXN_STATUS = (colors: any, t: any) => ({
  completed: { bg: colors.successLight, text: colors.success, label: t('owner.transactions.statusCompleted') },
  verifying: { bg: colors.warningLight, text: colors.warning, label: t('owner.transactions.statusVerifying') },
  reversed: { bg: colors.errorLight, text: colors.error, label: t('owner.transactions.statusReversed') },
  failed: { bg: colors.borderLight, text: colors.text.secondary, label: t('owner.transactions.statusFailed') },
});

interface AddPaymentModalProps {
  visible: boolean;
  rentRecordId: string;
  onClose: () => void;
  onSaved: () => void;
  t: (key: string) => string;
}

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({ visible, rentRecordId, onClose, onSaved, t }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setAmount(''); setMethod('cash'); setPaymentDate(new Date().toISOString().split('T')[0]); setNote(''); setImageUri(null); }
  }, [visible]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('owner.transactions.alertPermissionTitle'), t('owner.transactions.alertPermissionMsg')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, quality: 0.8 });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('amount', String(parseFloat(amount)));
      form.append('paymentMethod', method);
      form.append('transactionType', method);
      form.append('paymentDate', paymentDate);
      if (note.trim()) form.append('note', note.trim());
      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'proof.jpg';
        const m = /\.(\w+)$/.exec(filename);
        const type = m ? `image/${m[1]}` : 'image/jpeg';
        form.append('proofImage', { uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri, name: filename, type } as any);
      }
      return addTransaction(rentRecordId, form);
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.response?.data?.message || err?.message || t('owner.transactions.alertErrRecord')),
  });

  const amountNum = parseFloat(amount);
  const valid = !isNaN(amountNum) && amountNum > 0 && paymentDate.trim();

  return (
    <KeyboardSafeModal
      visible={visible}
      animationType="slide"
      overlayStyle={[styles.modalOverlay, { paddingBottom: insets.bottom + 64 }]}
      onRequestClose={onClose}
    >
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{t('owner.transactions.addPaymentTitle')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.transactions.fieldAmount')}</Text>
            <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.tertiary} />

            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.transactions.fieldMethod')}</Text>
            <View style={styles.methodRow}>
              {['cash', 'upi', 'bank_transfer', 'cheque'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodChip, { backgroundColor: method === m ? colors.primary : colors.background, borderColor: method === m ? colors.primary : colors.border }]}
                  onPress={() => setMethod(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.methodText, { color: method === m ? '#FFFFFF' : colors.text.secondary }]}>
                    {m === 'bank_transfer' ? 'Bank' : m === 'upi' ? 'UPI' : m === 'cheque' ? 'Cheque' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.transactions.fieldDate')}</Text>
            <View style={[styles.dateCell, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.text.secondary} />
              <CalendarPicker value={paymentDate} onChange={setPaymentDate} maxDate={new Date().toISOString().split('T')[0]} />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.transactions.fieldNotes')}</Text>
            <TextInput style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]} value={note} onChangeText={setNote}                  placeholder={t('owner.transactions.placeholderNotes')} placeholderTextColor={colors.text.tertiary} maxLength={200} />

            <TouchableOpacity style={[styles.imagePicker, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={pickImage} activeOpacity={0.7}>
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeImage} onPress={() => setImageUri(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="image-outline" size={22} color={colors.text.tertiary} />
                  <Text style={[styles.imagePickerText, { color: colors.text.secondary }]}>{t('owner.transactions.btnAttachProof')}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalActions}>
             <TouchableOpacity style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
               <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.transactions.btnCancel')}</Text>
             </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: valid && !saveMutation.isPending ? colors.primary : colors.border }]}
              onPress={() => saveMutation.mutate()}
              disabled={!valid || saveMutation.isPending}
              activeOpacity={0.8}
            >
               {saveMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalBtnSaveText}>{t('owner.transactions.btnRecord')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
    </KeyboardSafeModal>
  );
};

export const OwnerTransactionDetailScreen: React.FC<{ rentRecordId: string }> = ({ rentRecordId }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [reverseTarget, setReverseTarget] = useState<OwnerTransaction | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [addPaymentVisible, setAddPaymentVisible] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ownerPaymentDetail', rentRecordId],
    queryFn: () => getPaymentDetail(rentRecordId),
    staleTime: 60 * 1000,
  });

  const transactions = data?.transactions ?? [];
  const rentRecord = data?.rentRecord;
  const totalPaid = transactions.filter(t => t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const floatingBalance = Math.max(0, rentRecord?.advanceBalance ?? 0);
  const hasVerifying = transactions.some(t => t.status === 'verifying');
  const first = transactions[0];

  const verifyMutation = useMutation({
    mutationFn: verifyTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerPaymentDetail', rentRecordId] });
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.transactions.errVerify')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTransaction(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerPaymentDetail', rentRecordId] });
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.transactions.errReject')),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reverseTransaction(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerPaymentDetail', rentRecordId] });
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      setReverseTarget(null);
      setReverseReason('');
      Alert.alert(t('owner.transactions.reversedAlertTitle'), t('owner.transactions.reversedAlertMsg'));
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.transactions.errReverse')),
  });

  const confirmReverse = () => {
    if (!reverseTarget) return;
    if (!reverseReason.trim()) return;
    reverseMutation.mutate({ id: reverseTarget._id, reason: reverseReason.trim() });
  };

  const undoMutation = useMutation({
    mutationFn: (id: string) => reverseTransaction(id, 'Reversal undone / Re-activated'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerPaymentDetail', rentRecordId] });
      qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
      Alert.alert(t('owner.transactions.undoneAlertTitle'), t('owner.transactions.undoneAlertMsg'));
    },
    onError: (err: any) => Alert.alert(t('owner.commonOwner.error'), err?.message || t('owner.transactions.errUndo')),
  });

  const confirmUndo = (txn: OwnerTransaction) => {
      Alert.alert(t('owner.transactions.undoTitle'), t('owner.transactions.undoMsg', { amount: formatCurrency(txn.amount) }), [
        { text: t('owner.transactions.btnCancel2'), style: 'cancel' },
        { text: t('owner.transactions.undoConfirm'), onPress: () => undoMutation.mutate(txn._id) },
      ]);
  };

  const txnStatus = TXN_STATUS(colors, t);
  const isAdvanceTx = (t: OwnerTransaction) =>
    t.transactionType === 'advance_applied' || t.transactionType === 'advance_deducted';
  const monthLabel = first?.rentRecordId?.month ?? rentRecord?.month ?? '';
  const tenantName = first?.tenantId?.userId?.name;
  const roomLabel = first?.tenantId?.roomId?.roomNumber;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]} numberOfLines={1}>{tenantName || t('owner.transactions.fallbackTitle')}</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>{monthLabel ? `${monthLabel} · ` : ''}{roomLabel ? `Room ${roomLabel}` : ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('owner.transactions.errLoad')}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()} activeOpacity={0.8}>
              <Text style={styles.retryText}>{t('owner.transactions.btnRetry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Summary */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadows.sm]}>
              <Text style={[styles.summaryTotal, { color: colors.text.primary }]}>{formatCurrency(totalPaid)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>{t('owner.transactions.totalCollected')}</Text>
              {floatingBalance > 0 && (
                <View style={[styles.floatBanner, { backgroundColor: colors.infoLight }]}>
                  <Ionicons name="water-outline" size={16} color={colors.info} />
                  <Text style={[styles.floatText, { color: colors.info }]}>
                    {t('owner.transactions.floatBanner', { amount: formatCurrency(floatingBalance) })}
                  </Text>
                </View>
              )}
              {hasVerifying && (
                <View style={[styles.verifyingBanner, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="time-outline" size={16} color={colors.warning} />
                  <Text style={[styles.verifyingText, { color: colors.warning }]}>{t('owner.transactions.proofAwaiting')}</Text>
                </View>
              )}
            </View>

            {/* Transactions */}
            <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>{t('owner.transactions.sectionTransactions')}</Text>
            {transactions.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface }, shadows.sm]}>
                <Ionicons name="receipt-outline" size={40} color={colors.text.tertiary} />
                 <Text style={[styles.emptyText, { color: colors.text.secondary }]}>{t('owner.transactions.emptyTitle')}</Text>
              </View>
            ) : (
              transactions.map(txn => {
                const cfg = txnStatus[txn.status] ?? { bg: colors.borderLight, text: colors.text.secondary, label: txn.status };
                const isAdvance = isAdvanceTx(txn);
                return (
                  <View key={txn._id} style={[styles.txnCard, { backgroundColor: colors.surface }, shadows.sm]}>
                    <View style={styles.txnTop}>
                      <View style={[styles.txnIconWrap, { backgroundColor: isAdvance ? colors.infoLight : colors.primaryLight }]}>
                        <Ionicons name={isAdvance ? 'swap-horizontal' : 'card-outline'} size={18} color={isAdvance ? colors.info : colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.txnAmount, { color: colors.text.primary }]}>{formatCurrency(txn.amount)}</Text>
                         <Text style={[styles.txnMeta, { color: colors.text.secondary }]}>
                           {txn.paymentMethod} · {formatDate(txn.paymentDate || txn.createdAt)}
                         </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: isAdvance ? colors.borderLight : cfg.bg }]}>
                        <Text style={[styles.badgeText, { color: isAdvance ? colors.text.secondary : cfg.text }]}>
                          {isAdvance ? t('owner.transactions.txnAdvance') : cfg.label}
                        </Text>
                      </View>
                    </View>

                    {isAdvance && (
                      <View style={[styles.floatTag, { backgroundColor: colors.infoLight }]}>
                        <Ionicons
                          name={txn.transactionType === 'advance_applied' ? 'add-circle-outline' : 'remove-circle-outline'}
                          size={14}
                          color={colors.info}
                        />
                        <Text style={[styles.floatTagText, { color: colors.info }]}>
                           {txn.transactionType === 'advance_deducted'
                             ? t('owner.transactions.floatMovedOut', { amount: formatCurrency(Math.abs(txn.amount)) })
                             : t('owner.transactions.floatMovedIn', { amount: formatCurrency(Math.abs(txn.amount)) })}
                        </Text>
                      </View>
                    )}

                     {txn.transactionId ? <Text style={[styles.txnRef, { color: colors.text.tertiary }]}>{t('owner.transactions.refLabel', { ref: txn.transactionId })}</Text> : null}
                    {txn.note ? <Text style={[styles.txnNote, { color: colors.text.secondary }]}>{txn.note}</Text> : null}
                     {txn.recordedBy?.name ? <Text style={[styles.txnMeta, { color: colors.text.tertiary }]}>{t('owner.transactions.recordedBy', { name: txn.recordedBy.name, role: txn.createdByRole })}</Text> : null}

                     {txn.proofImage?.secureUrl && (
                       <TouchableOpacity onPress={() => setLightboxUri(txn.proofImage!.secureUrl)} activeOpacity={0.8}>
                         <Image source={{ uri: txn.proofImage.secureUrl }} style={styles.proofImage} resizeMode="cover" />
                       </TouchableOpacity>
                     )}

                    {txn.status === 'verifying' && (
                      <View style={styles.txnActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => verifyMutation.mutate(txn._id)} disabled={verifyMutation.isPending} activeOpacity={0.8}>
                          {verifyMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.actionText}>{t('owner.transactions.btnVerify')}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.error }]} onPress={() => rejectMutation.mutate({ id: txn._id, reason: 'Rejected by owner' })} disabled={rejectMutation.isPending} activeOpacity={0.8}>
                           <Text style={styles.actionText}>{t('owner.transactions.btnReject')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {!isAdvance && txn.status === 'completed' && (
                      <TouchableOpacity style={[styles.reverseBtn, { borderColor: colors.error }]} onPress={() => setReverseTarget(txn)} activeOpacity={0.7}>
                        <Ionicons name="arrow-undo-outline" size={16} color={colors.error} />
                         <Text style={[styles.reverseText, { color: colors.error }]}>{t('owner.transactions.btnReverse')}</Text>
                      </TouchableOpacity>
                    )}
                    {!isAdvance && txn.status === 'reversed' && (
                      <TouchableOpacity style={[styles.reverseBtn, { borderColor: colors.success }]} onPress={() => confirmUndo(txn)} disabled={undoMutation.isPending} activeOpacity={0.7}>
                        {undoMutation.isPending ? <ActivityIndicator size="small" color={colors.success} /> : <Ionicons name="arrow-redo-outline" size={16} color={colors.success} />}
                         <Text style={[styles.reverseText, { color: colors.success }]}>{t('owner.transactions.btnUndoReversal')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setAddPaymentVisible(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addBtnText}>{t('owner.transactions.btnRecord')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <AddPaymentModal
        visible={addPaymentVisible}
        rentRecordId={rentRecordId}
        onClose={() => setAddPaymentVisible(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['ownerPaymentDetail', rentRecordId] });
          qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
          qc.invalidateQueries({ queryKey: ['ownerPaymentSummary'] });
        }}
        t={t}
      />

      {/* Reverse modal */}
      <KeyboardSafeModal
        visible={!!reverseTarget}
        animationType="fade"
        overlayStyle={[styles.modalOverlay, { paddingBottom: insets.bottom + 64 }]}
        onRequestClose={() => { setReverseTarget(null); setReverseReason(''); }}
      >
          <View style={[styles.reverseSheet, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <Text style={[styles.reverseTitle, { color: colors.text.primary }]}>{t('owner.transactions.reverseTitle')}</Text>
            <Text style={[styles.reverseSub, { color: colors.text.secondary }]}>
              {reverseTarget ? t('owner.transactions.reverseSub', { date: formatDate(reverseTarget.paymentDate || reverseTarget.createdAt), amount: formatCurrency(reverseTarget.amount) }) : ''}
            </Text>
            <TextInput
              style={[styles.reverseInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              value={reverseReason}
              onChangeText={setReverseReason}
               placeholder={t('owner.transactions.reversePlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderWidth: 1, borderColor: colors.border }]} onPress={() => { setReverseTarget(null); setReverseReason(''); }} activeOpacity={0.7}>
                 <Text style={[styles.modalBtnText, { color: colors.text.secondary }]}>{t('owner.transactions.btnCancel2')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: reverseReason.trim() && !reverseMutation.isPending ? colors.error : colors.border }]}
                onPress={confirmReverse}
                disabled={!reverseReason.trim() || reverseMutation.isPending}
                activeOpacity={0.8}
              >
                {reverseMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> :                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>{t('owner.transactions.reverseBtn')}</Text>}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
      </KeyboardSafeModal>

      <ImageLightbox uri={lightboxUri!} visible={!!lightboxUri} onClose={() => setLightboxUri(null)} />
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
  scroll: { padding: spacing.xl, gap: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.huge },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: radius.full },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  summaryCard: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  summaryTotal: { fontSize: 28, fontWeight: '800' },
  summaryLabel: { fontSize: 12 },
  verifyingBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm },
  verifyingText: { fontSize: 13, fontWeight: '600' },
  floatBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm },
  floatText: { fontSize: 13, fontWeight: '600' },
  floatTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.full, alignSelf: 'flex-start' },
  floatTagText: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.sm },
  emptyCard: { borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 14, textAlign: 'center' },
  txnCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  txnTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  txnIconWrap: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  txnAmount: { fontSize: 16, fontWeight: '700' },
  txnMeta: { fontSize: 12, marginTop: 2 },
  txnRef: { fontSize: 11 },
  txnNote: { fontSize: 13 },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  proofImage: { width: '100%', height: 180, borderRadius: radius.md, marginTop: spacing.xs },
  txnActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  reverseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, height: 42 },
  reverseText: { fontSize: 14, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 50, borderRadius: radius.lg },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xxl, paddingBottom: spacing.xxxl + spacing.xxl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm, marginTop: spacing.xs },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15, marginBottom: spacing.md },
  dateCell: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  methodChip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  methodText: { fontSize: 13, fontWeight: '600' },
  imagePicker: { borderWidth: 1, borderRadius: radius.md, height: 90, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  imagePickerText: { fontSize: 13 },
  previewImage: { width: 120, height: 80, borderRadius: radius.md },
  removeImage: { position: 'absolute', top: 6, right: 6 },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalBtn: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  modalBtnSaveText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  reverseSheet: { margin: spacing.xl, maxHeight: '90%', borderRadius: radius.xxl, padding: spacing.xxl },
  reverseTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  reverseSub: { fontSize: 13, marginBottom: spacing.xl },
  reverseInput: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, height: 80, textAlignVertical: 'top', paddingTop: spacing.sm, marginBottom: spacing.lg },
});