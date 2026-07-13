import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRentRecordDetail, createCashfreeOrder, getCashfreePaymentStatus, submitManualPayment } from '../api/payment';
import { PaymentTransaction } from '../types/payment';
import { AppCard, AppButton, AppInput, StatusBadge, GradientCard } from '../components';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { formatCurrency, formatMonth, formatDate, generateAndShareReceipt } from '../utils';

interface RentDetailScreenProps {
  rentRecordId: string;
  onBack: () => void;
}

export const RentDetailScreen: React.FC<RentDetailScreenProps> = ({ rentRecordId, onBack }) => {
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
    queryFn: () => getRentRecordDetail(rentRecordId),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentRecordDetail', rentRecordId] });
      queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      setShowManualModal(false);
      resetManualForm();
      Alert.alert('Submitted', 'Payment submitted for verification');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to submit payment'),
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
    setPaying(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      const response = await createCashfreeOrder(rentRecordId, data.rentRecord.remainingAmount, redirectUrl);
      if (response.success && response.paymentUrl) {
        try {
          const result = await WebBrowser.openAuthSessionAsync(response.paymentUrl, redirectUrl, { showTitle: true });
          if (result.type === 'success' || result.type === 'dismiss' || result.type === 'cancel') {
            checkPaymentStatus(response.orderId);
          }
        } catch {
          const canOpen = await Linking.canOpenURL(response.paymentUrl);
          if (canOpen) {
            await Linking.openURL(response.paymentUrl);
            Alert.alert('Payment Initiated', 'Complete payment in browser.', [
              { text: 'Check Status', onPress: () => checkPaymentStatus(response.orderId) },
            ]);
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setPaying(false);
    }
  };

  const checkPaymentStatus = async (orderId: string) => {
    setPolling(true);
    try {
      const response = await getCashfreePaymentStatus(orderId);
      if (response.status === 'PAID') {
        Alert.alert('Success', 'Payment received!');
        queryClient.invalidateQueries({ queryKey: ['rentRecordDetail', rentRecordId] });
        queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      } else if (response.status === 'FAILED') {
        Alert.alert('Payment Failed', 'Transaction failed.');
      } else {
        Alert.alert('Pending', 'May take a few minutes to reflect.');
      }
    } catch {
      Alert.alert('Error', 'Could not check payment status');
    } finally {
      setPolling(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!record) return;
    try {
      await generateAndShareReceipt({
        tenantName: (data as any)?.rentRecord?.userId?.name || (data as any)?.rentRecord?.tenantId?.userId?.name || 'Tenant',
        propertyName: (data as any)?.rentRecord?.propertyId?.name || 'Property',
        roomNumber: (data as any)?.rentRecord?.roomId?.roomNumber || '',
        month: formatMonth(record.month),
        totalRent: record.totalRent || 0,
        totalPaid: record.totalPaid || 0,
        paidDate: formatDate(transactions[0]?.paymentDate || record.dueDate || new Date()),
        ownerName: (record.ownerId as any)?.name || 'Property Owner',
        transactionId: transactions[0]?._id || transactions[0]?.referenceId,
      });
    } catch (e: any) {
      console.error('Failed to generate receipt:', e);
      Alert.alert('Error', `Failed to generate receipt: ${e?.message || String(e)}`);
    }
  };

  const handleManualSubmit = () => {
    if (!manualForm.amount || isNaN(Number(manualForm.amount))) {
      Alert.alert('Error', 'Enter a valid amount');
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
          <Text style={styles.errorText}>Record not found</Text>
          <AppButton title="Go Back" onPress={onBack} variant="outline" style={{ marginTop: spacing.lg }} />
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
        <GradientCard gradient={['#2563EB', '#1D4ED8'] as const} style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <View style={styles.summaryTop}>
              <Text style={styles.summaryLabel}>Total Rent</Text>
              <StatusBadge status={record.status} />
            </View>
            <Text style={styles.summaryAmount}>{formatCurrency(record.totalRent)}</Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.min(progress * 100, 100)}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>Paid: {formatCurrency(record.totalPaid)}</Text>
                <Text style={styles.progressLabel}>Remaining: {formatCurrency(record.remainingAmount)}</Text>
              </View>
            </View>

            <View style={styles.summaryDetails}>
              <View style={styles.summaryDetailItem}>
                <Text style={styles.summaryDetailLabel}>Due Date</Text>
                <Text style={styles.summaryDetailValue}>{formatDate(record.dueDate)}</Text>
              </View>
              <View style={styles.summaryDetailItem}>
                <Text style={styles.summaryDetailLabel}>Month</Text>
                <Text style={styles.summaryDetailValue}>{formatMonth(record.month)}</Text>
              </View>
            </View>
          </View>
        </GradientCard>

        {!isPaid ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.payOnlineButton} onPress={handlePayOnline} disabled={polling || paying} activeOpacity={0.8}>
              <Ionicons name="globe-outline" size={20} color="#FFFFFF" />
              <Text style={styles.payOnlineText}>{paying ? 'Initiating...' : polling ? 'Checking...' : 'Pay Online'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.payManualButton}
              onPress={() => {
                setManualForm({ ...manualForm, amount: record.remainingAmount.toString() });
                setShowManualModal(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="wallet-outline" size={20} color={colors.primary} />
              <Text style={styles.payManualText}>Manual Payment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.downloadReceiptButton} onPress={handleDownloadReceipt} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.downloadReceiptText}>Download Receipt</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Transaction History</Text>
        <AppCard variant="elevated" padding={spacing.md}>
          {transactions.length > 0 ? (
            transactions.map((txn: PaymentTransaction, idx: number) => (
              <View key={txn._id} style={[styles.txnItem, idx === transactions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.txnLeft}>
                  <View style={[styles.txnIcon, {
                    backgroundColor:
                      txn.status === 'completed' || txn.status === 'verified'
                        ? colors.successLight
                        : txn.status === 'rejected' ? colors.errorLight : colors.warningLight,
                  }]}>
                    <Ionicons
                      name={txn.status === 'completed' || txn.status === 'verified' ? 'checkmark' : txn.status === 'rejected' ? 'close' : 'time'}
                      size={16}
                      color={txn.status === 'completed' || txn.status === 'verified' ? colors.success : txn.status === 'rejected' ? colors.error : colors.warning}
                    />
                  </View>
                  <View>
                    <Text style={styles.txnMethod}>{txn.paymentMethod.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.txnDate}>{formatDate(txn.paymentDate)}</Text>
                  </View>
                </View>
                <View style={styles.txnRight}>
                  <Text style={styles.txnAmount}>{formatCurrency(txn.amount)}</Text>
                  <StatusBadge status={txn.status} size="sm" />
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyTxn}>
              <Ionicons name="receipt-outline" size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyTxnText}>No transactions yet</Text>
            </View>
          )}
        </AppCard>
      </ScrollView>

      <Modal visible={showManualModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual Payment</Text>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppInput
                label="Amount Paid"
                placeholder="Enter amount"
                value={manualForm.amount}
                onChangeText={(text) => setManualForm({ ...manualForm, amount: text })}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Payment Method</Text>
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
                  <Text style={styles.upiTitle}>Pay to Owner via UPI</Text>
                  {(record.ownerId as any)?.upiId && (
                    <Text selectable style={styles.upiText}>ID: {(record.ownerId as any).upiId}</Text>
                  )}
                  {(record.ownerId as any)?.upiNumber && (
                    <Text selectable style={styles.upiText}>Phone: {(record.ownerId as any).upiNumber}</Text>
                  )}
                  {(record.ownerId as any)?.qrCodeImage?.secureUrl && (
                    <Image source={{ uri: (record.ownerId as any).qrCodeImage.secureUrl }} style={styles.qrImage} resizeMode="contain" />
                  )}
                </View>
              )}

              <AppInput
                label="Transaction ID (Optional)"
                placeholder="e.g. UPI Ref Number"
                value={manualForm.transactionId}
                onChangeText={(text) => setManualForm({ ...manualForm, transactionId: text })}
              />
              <AppInput
                label="Note (Optional)"
                placeholder="Additional info"
                value={manualForm.note}
                onChangeText={(text) => setManualForm({ ...manualForm, note: text })}
              />

              <Text style={styles.fieldLabel}>Payment Proof (Optional)</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.7}>
                {proofImage ? (
                  <Image source={{ uri: proofImage }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="camera-outline" size={32} color={colors.text.tertiary} />
                    <Text style={styles.imagePickerText}>Upload Receipt</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.manualButtons}>
                <AppButton title="Cancel" onPress={() => setShowManualModal(false)} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
                <AppButton title="Submit" onPress={handleManualSubmit} loading={mutationManual.isPending} style={{ flex: 1, marginLeft: spacing.sm }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {paying && (
        <View style={styles.payingOverlay}>
          <View style={styles.payingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.payingText}>Initiating payment...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    flexDirection: 'row',
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
    color: '#FFFFFF',
  },
  payOnlineButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  payOnlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  payManualButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  payManualText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
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
    color: '#FFFFFF',
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
    marginBottom: spacing.sm,
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
