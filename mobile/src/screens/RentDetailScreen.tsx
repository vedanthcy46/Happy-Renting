import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
  Linking,
  Text,
  View,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image as CachedImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { createCashfreeOrder, getCashfreePaymentStatus, submitManualPayment } from '../api/payment';
import { cachedRentRecordDetail } from '../repositories';
import { PaymentTransaction } from '../types/payment';
import { AppCard, AppButton, AppInput, StatusBadge, GradientCard } from '../components';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { formatCurrency, formatMonth, formatDate, generateAndShareReceipt } from '../utils';
import { maybeRequestRating } from '../utils/rateApp';

interface RentDetailScreenProps {
  rentRecordId: string;
  onBack: () => void;
}

// Payment gateway (Cashfree online checkout) is currently blocked.
const PAYMENT_GATEWAY_ENABLED = false;

export const RentDetailScreen: React.FC<RentDetailScreenProps> = ({ rentRecordId, onBack }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    amount: '',
    paymentMethod: 'upi',
    transactionId: '',
    note: '',
  });
  const [proofImage, setProofImage] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rentRecordDetail', rentRecordId],
    queryFn: cachedRentRecordDetail(rentRecordId),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // Silently handle — data just won't update
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const mutationManual = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) => submitManualPayment(id, formData),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rentRecordDetail', rentRecordId] });
      queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      setShowManualModal(false);
      resetManualForm();
      if (res.transaction?.queued) {
        Alert.alert(t('rentDetail.paymentQueuedTitle'), t('rentDetail.paymentQueuedBody'));
      } else {
        Alert.alert(t('rentDetail.submittedTitle'), t('rentDetail.submittedBody'));
        maybeRequestRating();
      }
    },
    onError: (error: any) => Alert.alert(t('common.error'), error.response?.data?.message || t('rentDetail.submitFailed')),
  });

  const resetManualForm = () => {
    setManualForm({ amount: '', paymentMethod: 'upi', transactionId: '', note: '' });
    setProofImage(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setProofImage(result.assets[0].uri);
  };

  const handlePayOnline = async () => {
    if (!data?.rentRecord) return;
    if (!PAYMENT_GATEWAY_ENABLED) {
      Alert.alert(
        t('rentDetail.gatewayUnavailableTitle'),
        t('rentDetail.gatewayUnavailableBody')
      );
      return;
    }
    setPaying(true);
    
    // The deep link scheme that Cashfree will redirect back to after payment
    // This MUST match the scheme in app.json
    const APP_DEEP_LINK = 'happyrenting://payment';
    
    try {
      const response = await createCashfreeOrder(
        rentRecordId,
        data.rentRecord.remainingAmount,
        APP_DEEP_LINK   // app_redirect sent to backend → baked into checkout proxy HTML
      );
      
      if (response.success && response.paymentUrl) {
        // Set up deep link listener BEFORE opening browser
        // When Cashfree proxy redirects to happyrenting://payment?order_id=...
        // Android will fire this, closing Chrome Custom Tabs automatically
        let subscription: any = null;
        
        const onDeepLink = ({ url }: { url: string }) => {
          if (url.startsWith('happyrenting://payment')) {
            subscription?.remove();
            // Extract orderId from the deep link URL
            const urlObj = new URL(url);
            const returnedOrderId = urlObj.searchParams.get('order_id') || response.orderId;
            setPaying(false);
            checkPaymentStatus(returnedOrderId);
          }
        };
        
        subscription = Linking.addEventListener('url', onDeepLink);
        
        // Open the payment URL in the default browser (Chrome Custom Tabs on Android)
        // Do NOT use openAuthSessionAsync — it only closes when it detects its own redirectUrl
        // in the address bar. Cashfree goes to Netlify first, not our scheme.
        const opened = await Linking.openURL(response.paymentUrl);
        
        // Show a fallback dialog the user can use to manually check status
        // in case the deep link never fires (e.g. user completes payment but
        // the browser doesn't close)
        Alert.alert(
          t('rentDetail.paymentOpenedTitle'),
          t('rentDetail.paymentOpenedBody'),
          [
            {
              text: t('rentDetail.checkStatus'),
              onPress: () => {
                subscription?.remove();
                setPaying(false);
                checkPaymentStatus(response.orderId);
              },
            },
            {
              text: t('common.cancel'),
              style: 'cancel',
              onPress: () => {
                subscription?.remove();
                setPaying(false);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.message || t('rentDetail.initiateFailed'));
      setPaying(false);
    }
  };

  const checkPaymentStatus = async (orderId: string) => {
    setPolling(true);
    try {
      const response = await getCashfreePaymentStatus(orderId);
      if (response.status === 'PAID') {
        Alert.alert(t('common.success'), t('rentDetail.paymentReceived'));
        queryClient.invalidateQueries({ queryKey: ['rentRecordDetail', rentRecordId] });
        queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
        maybeRequestRating();
      } else if (response.status === 'FAILED') {
        Alert.alert(t('rentDetail.paymentFailedTitle'), t('rentDetail.transactionFailed'));
      } else {
        Alert.alert(t('rentDetail.pendingTitle'), t('rentDetail.pendingBody'));
      }
    } catch {
      Alert.alert(t('common.error'), t('rentDetail.statusCheckFailed'));
    } finally {
      setPolling(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!record) return;
    try {
      await generateAndShareReceipt({
        tenantName: (data as any)?.rentRecord?.userId?.name || (data as any)?.rentRecord?.tenantId?.userId?.name || t('rentDetail.fallbackTenant'),
        propertyName: (data as any)?.rentRecord?.propertyId?.name || t('rentDetail.fallbackProperty'),
        roomNumber: (data as any)?.rentRecord?.roomId?.roomNumber || '',
        month: formatMonth(record.month),
        totalRent: record.totalRent || 0,
        totalPaid: record.totalPaid || 0,
        paidDate: formatDate(transactions[0]?.paymentDate || record.dueDate || new Date()),
        ownerName: (record.ownerId as any)?.name || t('rentDetail.fallbackOwner'),
        transactionId: transactions[0]?._id || transactions[0]?.referenceId,
      });
    } catch (e: any) {
      console.error('Failed to generate receipt:', e);
      Alert.alert(t('common.error'), t('rentDetail.receiptFailed', { error: e?.message || String(e) }));
    }
  };

  const handleManualSubmit = () => {
    if (!manualForm.amount || isNaN(Number(manualForm.amount))) {
      Alert.alert(t('common.error'), t('rentDetail.invalidAmount'));
      return;
    }
    const formData = new FormData();
    formData.append('amount', manualForm.amount);
    formData.append('paymentMethod', manualForm.paymentMethod);
    formData.append('transactionId', manualForm.transactionId);
    formData.append('note', manualForm.note);
    if (proofImage) {
      const uriParts = proofImage.split('.');
      const fileType = uriParts[uriParts.length - 1];
      formData.append('image', { uri: proofImage, name: `proof.${fileType}`, type: `image/${fileType}` } as any);
    }
    mutationManual.mutate({ id: rentRecordId, formData });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const record = data?.rentRecord;
  const transactions = data?.transactions || [];
  const isPaid = record?.status === 'paid' || record?.status === 'overpaid';

  if (!record) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{t('rentDetail.recordNotFound')}</Text>
          <AppButton title={t('common.back')} onPress={onBack} variant="outline" style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    );
  }

  const progress = record.totalRent > 0 ? record.totalPaid / record.totalRent : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{formatMonth(record.month)}</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <GradientCard gradient={['#4B6BED', '#3D56C9'] as const} style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <View style={styles.summaryTop}>
              <Text style={styles.summaryLabel}>{t('rent.totalRent')}</Text>
              <StatusBadge status={record.status} />
            </View>
            <Text style={styles.summaryAmount}>{formatCurrency(record.totalRent)}</Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.min(progress * 100, 100)}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>{t('rentDetail.paidLabel', { amount: formatCurrency(record.totalPaid) })}</Text>
                <Text style={styles.progressLabel}>{t('rentDetail.remainingLabel', { amount: formatCurrency(record.remainingAmount) })}</Text>
              </View>
              {(record.advanceBalance || 0) > 0 && (
                <View style={styles.floatingBadge}>
                  <Ionicons name="trending-up" size={12} color="#BBF7D0" />
                  <Text style={styles.floatingBadgeText}>{t('rentDetail.floatingBalance', { amount: formatCurrency(record.advanceBalance || 0) })}</Text>
                </View>
              )}
            </View>

            <View style={styles.summaryDetails}>
              <View style={styles.summaryDetailItem}>
                <Text style={styles.summaryDetailLabel}>{t('rent.dueDate')}</Text>
                <Text style={styles.summaryDetailValue}>{formatDate(record.dueDate)}</Text>
              </View>
              <View style={styles.summaryDetailItem}>
                <Text style={styles.summaryDetailLabel}>{t('rent.month')}</Text>
                <Text style={styles.summaryDetailValue}>{formatMonth(record.month)}</Text>
              </View>
            </View>
          </View>
        </GradientCard>

        {!isPaid ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.payManualButton}
              onPress={() => {
                setManualForm({ ...manualForm, amount: record.remainingAmount.toString() });
                setShowManualModal(true);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={colors.gradient.secondary as any} style={styles.payManualGradient}>
                <View style={styles.payManualContent}>
                  <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.payManualText}>{t('rentDetail.payViaUpi')}</Text>
                  <View style={styles.savingsBadge}>
                    <Ionicons name="leaf" size={12} color="#16A34A" />
                    <Text style={styles.savingsText}>{t('rentDetail.saveCharges')}</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payOnlineButton, !PAYMENT_GATEWAY_ENABLED && styles.payOnlineDisabled]}
              onPress={handlePayOnline}
              disabled={!PAYMENT_GATEWAY_ENABLED || polling || paying}
              activeOpacity={0.8}
            >
              <Ionicons name={PAYMENT_GATEWAY_ENABLED ? 'globe-outline' : 'lock-closed-outline'} size={20} color={PAYMENT_GATEWAY_ENABLED ? colors.text.secondary : colors.text.tertiary} />
              <Text style={[styles.payOnlineText, !PAYMENT_GATEWAY_ENABLED && styles.payOnlineTextDisabled]}>
                {PAYMENT_GATEWAY_ENABLED
                  ? paying ? t('rentDetail.initiating') : polling ? t('rentDetail.checking') : t('rentDetail.payOnline')
                  : t('rentDetail.gatewayUnavailable')}
              </Text>
            </TouchableOpacity>
            {!PAYMENT_GATEWAY_ENABLED && (
              <Text style={styles.gatewayNotice}>
                {t('rentDetail.gatewayNotice')}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.downloadReceiptButton} onPress={handleDownloadReceipt} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.downloadReceiptText}>{t('rentDetail.downloadReceipt')}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>{t('rentDetail.transactionHistory')}</Text>
        <AppCard variant="elevated" padding={spacing.md}>
          {transactions.length > 0 ? (
            transactions.map((txn: PaymentTransaction, idx: number) => {
              const isAdvance = txn.transactionType === 'advance_applied' || txn.transactionType === 'advance_deducted';
              const isWon = txn.status === 'completed' || txn.status === 'verified';
              const isBad = isWon && !isAdvance;
              return (
              <View key={txn._id} style={[styles.txnItem, idx === transactions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.txnLeft}>
                  <View style={[styles.txnIcon, {
                    backgroundColor:
                      isBad
                        ? colors.successLight
                        : txn.status === 'rejected' ? colors.errorLight : isAdvance ? colors.infoLight : colors.warningLight,
                  }]}>
                    <Ionicons
                      name={isBad ? 'checkmark' : isAdvance ? 'swap-horizontal' : txn.status === 'rejected' ? 'close' : 'time'}
                      size={16}
                      color={isBad ? colors.success : isAdvance ? colors.info : txn.status === 'rejected' ? colors.error : colors.warning}
                    />
                  </View>
                  <View>
                    <Text style={styles.txnMethod}>{isAdvance ? t('rentDetail.txnAdvance') : txn.paymentMethod.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.txnDate}>{formatDate(txn.paymentDate)}</Text>
                    {txn.queued && <Text style={styles.txnQueued}>{t('rentDetail.queued')}</Text>}
                  </View>
                </View>
                <View style={styles.txnRight}>
                  <Text style={styles.txnAmount}>{formatCurrency(txn.amount)}</Text>
                  {isAdvance ? (
                    <View style={[styles.statusBadge, { backgroundColor: colors.infoLight }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.info }]}>
                        {txn.status === 'reversed' ? t('rentDetail.txnReversed') : t('rentDetail.txnAdvance')}
                      </Text>
                    </View>
                  ) : (
                    <StatusBadge status={txn.status} size="sm" />
                  )}
                </View>
              </View>
              );
            })
          ) : (
            <View style={styles.emptyTxn}>
              <Ionicons name="receipt-outline" size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyTxnText}>{t('rentDetail.noTransactions')}</Text>
            </View>
          )}
        </AppCard>
      </ScrollView>

      <Modal visible={showManualModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('rentDetail.manualPayment')}</Text>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <AppInput
                label={t('rentDetail.amountPaid')}
                placeholder={t('rentDetail.enterAmount')}
                value={manualForm.amount}
                onChangeText={(text) => setManualForm({ ...manualForm, amount: text })}
                keyboardType="numeric"
              />

              <View style={styles.overpayNote}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.overpayNoteText}>
                  {t('rent.overpayNote')}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>{t('rentDetail.paymentMethod')}</Text>
              <View style={styles.methodRow}>
                {['upi', 'bank_transfer', 'cash', 'other'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodChip, manualForm.paymentMethod === m && styles.methodChipActive]}
                    onPress={() => setManualForm({ ...manualForm, paymentMethod: m })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.methodChipText, manualForm.paymentMethod === m && styles.methodChipTextActive]}>
                      {m.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {manualForm.paymentMethod === 'upi' && record.ownerId && (
                <View style={styles.upiBox}>
                  <Text style={styles.upiTitle}>{t('rentDetail.payUpiOwner')}</Text>
                  <Text selectable style={styles.upiText}>{t('rentDetail.upiName', { value: (record.ownerId as any)?.upiDetails?.upiName || 'N/A' })}</Text>
                  {(record.ownerId as any)?.upiId && (
                    <Text selectable style={styles.upiText}>{t('rentDetail.upiId', { value: (record.ownerId as any).upiId })}</Text>
                  )}
                  {(record.ownerId as any)?.upiNumber && (
                    <Text selectable style={styles.upiText}>{t('rentDetail.upiPhone', { value: (record.ownerId as any).upiNumber })}</Text>
                  )}
                  {(record.ownerId as any)?.qrCodeImage?.secureUrl && (
                    <CachedImage source={{ uri: (record.ownerId as any).qrCodeImage.secureUrl }} style={styles.qrImage} contentFit="contain" />
                  )}
                </View>
              )}

              <AppInput
                label={t('rentDetail.transactionId')}
                placeholder={t('rentDetail.transactionIdPlaceholder')}
                value={manualForm.transactionId}
                onChangeText={(text) => setManualForm({ ...manualForm, transactionId: text })}
              />
              <AppInput
                label={t('rentDetail.noteOptional')}
                placeholder={t('rentDetail.notePlaceholder')}
                value={manualForm.note}
                onChangeText={(text) => setManualForm({ ...manualForm, note: text })}
              />

              <Text style={styles.fieldLabel}>{t('rentDetail.proofOptional')}</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.7}>
                {proofImage ? (
                  <Image source={{ uri: proofImage }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="camera-outline" size={32} color={colors.text.tertiary} />
                    <Text style={styles.imagePickerText}>{t('rentDetail.uploadReceipt')}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.manualButtons}>
                <AppButton title={t('common.cancel')} onPress={() => setShowManualModal(false)} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
                <AppButton title={t('common.submit')} onPress={handleManualSubmit} loading={mutationManual.isPending} style={{ flex: 1, marginLeft: spacing.sm }} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {paying && (
        <View style={styles.payingOverlay}>
          <View style={styles.payingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.payingText}>{t('rentDetail.initiatingPayment')}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.huge + 40,
  },
  summaryCard: {
    marginBottom: spacing.xl,
  },
  summaryContent: {
    backgroundColor: 'transparent',
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    backgroundColor: 'transparent',
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'transparent',
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: spacing.lg,
    backgroundColor: 'transparent',
  },
  progressContainer: {
    marginBottom: spacing.xl,
    backgroundColor: 'transparent',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'transparent',
  },
  floatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  floatingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BBF7D0',
    backgroundColor: 'transparent',
  },
  summaryDetails: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: spacing.xxl,
  },
  summaryDetailItem: {
    backgroundColor: 'transparent',
  },
  summaryDetailLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  summaryDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  actionButtons: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  downloadReceiptButton: {
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
    ...shadows.md,
  },
  downloadReceiptText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  payManualButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  payManualGradient: {
    paddingVertical: spacing.lg + 4,
    paddingHorizontal: spacing.xl,
  },
  payManualContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  payManualText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 3,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  payOnlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  payOnlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  payOnlineDisabled: {
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceHover,
    opacity: 0.8,
  },
  payOnlineTextDisabled: {
    color: colors.text.tertiary,
  },
  gatewayNotice: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.warning,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  txnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  txnMethod: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  txnDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  txnQueued: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyTxn: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyTxnText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
    padding: spacing.xxl,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  overpayNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  overpayNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  methodChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  methodChipTextActive: {
    color: colors.text.inverse,
  },
  upiBox: {
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  upiTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  upiText: {
    fontSize: 13,
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  qrImage: {
    width: 160,
    height: 160,
    alignSelf: 'center',
    marginTop: spacing.md,
    borderRadius: radius.md,
  },
  imagePicker: {
    height: 140,
    backgroundColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xxl,
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  imagePickerText: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg - 2,
  },
  manualButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  payingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  payingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
    ...shadows.xl,
  },
  payingText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
