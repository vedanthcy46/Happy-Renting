import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { getRentRecords, createCashfreeOrder, getCashfreePaymentStatus, getRentRecordDetail, submitManualPayment, triggerBillingSync } from '../../src/api/payment';
import { RentRecord, PaymentTransaction } from '../../src/types/payment';
import { AppCard, AppButton, AppInput, StatusBadge, EmptyState, AppHeader } from '../../src/components';
import { colors, typography, spacing, radius, shadows } from '../../src/theme';
import { formatCurrency, formatMonth } from '../../src/utils';

export default function PaymentsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [polling, setPolling] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RentRecord | null>(null);
  const [showTxnModal, setShowTxnModal] = useState(false);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    amount: '',
    paymentMethod: 'upi',
    transactionId: '',
    note: '',
  });
  const [proofImage, setProofImage] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rentRecords'],
    queryFn: getRentRecords,
  });

  const { data: recordDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['rentRecordDetail', selectedRecord?._id],
    queryFn: () => getRentRecordDetail(selectedRecord!._id),
    enabled: !!selectedRecord,
  });

  const mutationManual = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) => submitManualPayment(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      setShowManualModal(false);
      resetManualForm();
      Alert.alert('Submitted', 'Payment submitted for verification');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed'),
  });

  const mutationSync = useMutation({
    mutationFn: triggerBillingSync,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      Alert.alert('Sync Complete', `Generated ${res.details?.billsCreated || 0} new bills.`);
    },
    onError: (error: any) => Alert.alert('Sync Failed', error.response?.data?.message || 'Failed to sync'),
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

  const handleManualSubmit = async () => {
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
    mutationManual.mutate({ id: selectedRecord!._id, formData });
  };

  const handlePayNow = async (record: RentRecord) => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ path: 'two' });
      const response = await createCashfreeOrder(record._id, record.remainingAmount, redirectUrl);
      if (response.success && response.paymentUrl) {
        try {
          const result = await WebBrowser.openAuthSessionAsync(response.paymentUrl, redirectUrl, { showTitle: true });
          if (result.type === 'cancel' || result.type === 'dismiss' || result.type === 'success') {
            checkPaymentStatus(response.orderId);
          }
        } catch {
          const canOpen = await Linking.canOpenURL(response.paymentUrl);
          if (canOpen) {
            await Linking.openURL(response.paymentUrl);
            Alert.alert('Payment Initiated', 'Complete payment in browser, then check status.', [
              { text: 'Check Status', onPress: () => checkPaymentStatus(response.orderId) },
            ]);
          }
        }
      } else {
        Alert.alert('Error', 'Payment gateway URL not found.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to initiate payment');
    }
  };

  const checkPaymentStatus = async (orderId: string) => {
    setPolling(true);
    try {
      const response = await getCashfreePaymentStatus(orderId);
      if (response.status === 'PAID') {
        Alert.alert('Success', 'Payment received!');
        refetch();
      } else if (response.status === 'FAILED') {
        Alert.alert('Payment Failed', 'Transaction failed.');
      } else {
        Alert.alert('Pending', 'May take a few minutes to reflect.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setPolling(false);
    }
  };

  const renderItem = ({ item }: { item: RentRecord }) => {
    const isPaid = item.status === 'paid' || item.status === 'overpaid';
    return (
      <AppCard style={styles.recordCard} variant="elevated">
        <TouchableOpacity
          onPress={() => { setSelectedRecord(item); setShowTxnModal(true); }}
          activeOpacity={0.7}
        >
          <View style={styles.recordHeader}>
            <View>
              <Text style={styles.monthText}>{formatMonth(item.month)}</Text>
              <Text style={styles.recordSubtext}>
                {isPaid ? 'All cleared' : `${formatCurrency(item.remainingAmount)} remaining`}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>

          <View style={styles.recordDivider} />

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total Rent</Text>
            <Text style={styles.amountValue}>{formatCurrency(item.totalRent)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Paid</Text>
            <Text style={[styles.amountValue, { color: colors.success }]}>{formatCurrency(item.totalPaid)}</Text>
          </View>
          {!isPaid && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Remaining</Text>
              <Text style={[styles.amountValue, { color: colors.error }]}>{formatCurrency(item.remainingAmount)}</Text>
            </View>
          )}
        </TouchableOpacity>

        {!isPaid && (
          <View style={styles.buttonRow}>
            <AppButton
              title="Pay Online"
              onPress={() => handlePayNow(item)}
              size="sm"
              disabled={polling}
              style={styles.payButton}
            />
            <AppButton
              title="Manual Pay"
              onPress={() => {
                setSelectedRecord(item);
                setManualForm({ ...manualForm, amount: item.remainingAmount.toString() });
                setShowManualModal(true);
              }}
              variant="outline"
              size="sm"
              style={styles.manualButton}
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => { setSelectedRecord(item); setShowTxnModal(true); }}
          activeOpacity={0.7}
        >
          <Text style={styles.historyLinkText}>View Transactions</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </AppCard>
    );
  };

  const renderContent = () => {
    if (isLoading && !data) {
      return (
        <View style={styles.centerFlex}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    const records = data?.rentRecords || [];
    if (records.length === 0) {
      return (
        <View style={styles.centerFlex}>
          <EmptyState
            icon="card-outline"
            title="No Payments Yet"
            description="Bills are generated on the 5th. Sync if you just joined."
            actionLabel="Sync My Billing"
            onAction={() => mutationSync.mutate()}
          />
        </View>
      );
    }

    return (
      <FlashList
        data={records}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading || polling} onRefresh={refetch} tintColor={colors.primary} />
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Payments"
        subtitle="Rent & billing history"
        style={{ paddingTop: insets.top + spacing.md }}
      />
      {renderContent()}

      {/* Transaction History Modal */}
      <Modal visible={showTxnModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {selectedRecord ? formatMonth(selectedRecord.month) : 'Transactions'}
              </Text>
              <TouchableOpacity onPress={() => { setShowTxnModal(false); setSelectedRecord(null); }}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {isLoadingDetail ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ margin: 30 }} />
            ) : (
              <ScrollView style={styles.txnList} showsVerticalScrollIndicator={false}>
                {recordDetail?.transactions && recordDetail.transactions.length > 0 ? (
                  recordDetail.transactions.map((txn: PaymentTransaction) => (
                    <View key={txn._id} style={styles.txnItem}>
                      <View style={styles.txnLeft}>
                        <View style={[styles.txnIcon, {
                          backgroundColor: txn.status === 'completed' || txn.status === 'verified'
                            ? colors.successLight : txn.status === 'rejected' ? colors.errorLight : colors.warningLight,
                        }]}>
                          <Ionicons
                            name={txn.status === 'completed' || txn.status === 'verified' ? 'checkmark' : txn.status === 'rejected' ? 'close' : 'time'}
                            size={18}
                            color={txn.status === 'completed' || txn.status === 'verified' ? colors.success : txn.status === 'rejected' ? colors.error : colors.warning}
                          />
                        </View>
                        <View>
                          <Text style={styles.txnMethod}>{txn.paymentMethod.replace('_', ' ').toUpperCase()}</Text>
                          <Text style={styles.txnDate}>{new Date(txn.paymentDate).toLocaleDateString()}</Text>
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
                    <Ionicons name="receipt-outline" size={48} color={colors.text.tertiary} />
                    <Text style={styles.emptyTxnText}>No transactions found</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Manual Payment Modal */}
      <Modal visible={showManualModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
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
                    style={[
                      styles.methodChip,
                      manualForm.paymentMethod === m && styles.methodChipActive,
                    ]}
                    onPress={() => setManualForm({ ...manualForm, paymentMethod: m })}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.methodChipText,
                      manualForm.paymentMethod === m && styles.methodChipTextActive,
                    ]}>
                      {m.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {manualForm.paymentMethod === 'upi' && recordDetail?.rentRecord?.ownerId && (
                <View style={styles.upiBox}>
                  <Text style={styles.upiTitle}>Pay to Owner via UPI</Text>
                  {recordDetail.rentRecord.ownerId.upiId && (
                    <Text selectable style={styles.upiText}>ID: {recordDetail.rentRecord.ownerId.upiId}</Text>
                  )}
                  {recordDetail.rentRecord.ownerId.upiNumber && (
                    <Text selectable style={styles.upiText}>Phone: {recordDetail.rentRecord.ownerId.upiNumber}</Text>
                  )}
                  {recordDetail.rentRecord.ownerId.qrCodeImage?.secureUrl && (
                    <Image
                      source={{ uri: recordDetail.rentRecord.ownerId.qrCodeImage.secureUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
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
                <AppButton
                  title="Submit"
                  onPress={handleManualSubmit}
                  loading={mutationManual.isPending}
                  style={{ flex: 1, marginLeft: spacing.sm }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  recordCard: {
    marginBottom: spacing.lg,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  monthText: {
    ...typography.h4,
    color: colors.text.primary,
  },
  recordSubtext: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: 2,
  },
  recordDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  amountLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  amountValue: {
    ...typography.subtitle,
    color: colors.text.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  payButton: {
    flex: 1,
  },
  manualButton: {
    flex: 1,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyLinkText: {
    ...typography.buttonSmall,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  txnList: {
    maxHeight: 400,
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
    ...typography.subtitle,
    color: colors.text.primary,
    fontSize: 14,
  },
  txnDate: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptyTxn: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
  },
  emptyTxnText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
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
    ...typography.buttonSmall,
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
    ...typography.subtitle,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  upiText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  qrImage: {
    width: 180,
    height: 180,
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
  },
  imagePickerText: {
    ...typography.body,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
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
});
