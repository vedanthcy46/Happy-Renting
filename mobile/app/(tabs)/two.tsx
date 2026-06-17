import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert, Modal, ScrollView, ActivityIndicator, TextInput, Image, Linking } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as AuthSession from 'expo-auth-session';
import { Text, View } from '@/components/Themed';
import { getRentRecords, createCashfreeOrder, getCashfreePaymentStatus, getRentRecordDetail, submitManualPayment, triggerBillingSync } from '../../src/api/payment';
import { RentRecord, PaymentTransaction } from '../../src/types/payment';

export default function PaymentsScreen() {
  const queryClient = useQueryClient();
  const [polling, setPolling] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RentRecord | null>(null);
  const [showTxnModal, setShowTxnModal] = useState(false);
  
  // Manual Payment State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    amount: '',
    paymentMethod: 'upi',
    transactionId: '',
    note: ''
  });
  const [proofImage, setProofImage] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rentRecords'],
    queryFn: getRentRecords,
  });

  const { data: recordDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['rentRecordDetail', selectedRecord?._id],
    queryFn: () => getRentRecordDetail(selectedRecord!._id),
    enabled: !!selectedRecord,
  });

  const mutationManual = useMutation({
    mutationFn: ({ id, formData }: { id: string, formData: FormData }) => submitManualPayment(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      setShowManualModal(false);
      resetManualForm();
      Alert.alert('Success', 'Payment submitted for verification');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit payment');
    },
  });

  const mutationSync = useMutation({
    mutationFn: triggerBillingSync,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      Alert.alert('Sync Complete', `Successfully generated ${res.details.billsCreated} new bills.`);
    },
    onError: (error: any) => {
      Alert.alert('Sync Failed', error.response?.data?.message || 'Failed to sync billing data');
    },
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

    if (!result.canceled) {
      setProofImage(result.assets[0].uri);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualForm.amount || isNaN(Number(manualForm.amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
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
      formData.append('image', {
        uri: proofImage,
        name: `proof.${fileType}`,
        type: `image/${fileType}`,
      } as any);
    }

    mutationManual.mutate({ id: selectedRecord!._id, formData });
  };

const handlePayNow = async (record: RentRecord) => {
  console.log('[Payment] Initiating for record:', record._id, 'amount:', record.remainingAmount);
  try {
    const redirectUrl = AuthSession.makeRedirectUri({ path: 'payments' });
    const response = await createCashfreeOrder(record._id, record.remainingAmount, redirectUrl);
    console.log('[Payment] Order created:', response);

    if (response.success && response.paymentUrl) {
      console.log('[Payment] Opening browser with URL:', response.paymentUrl);

      try {
        // Attempt 1: In-app Auth Session browser (Intercepts deep link to close automatically)
        const result = await WebBrowser.openAuthSessionAsync(response.paymentUrl, redirectUrl, {
          showTitle: true,
        });
        console.log('[Payment] Auth Session result:', result);

        if (result.type === 'cancel' || result.type === 'dismiss' || result.type === 'success') {
          checkPaymentStatus(response.orderId);
        }
      } catch (browserError) {
        console.warn('[Payment] In-app browser failed, using fallback:', browserError);
        // Attempt 2: System browser (Fallback)
        const canOpen = await Linking.canOpenURL(response.paymentUrl);
        if (canOpen) {
          await Linking.openURL(response.paymentUrl);
          // Since we moved to external browser, we can't detect "close"
          // We should show a "Check Status" button or poll automatically
          Alert.alert('Payment Initiated', 'Please return here after completing the payment.', [
            { text: 'OK', onPress: () => checkPaymentStatus(response.orderId) }
          ]);
        } else {
          Alert.alert('Error', 'Could not open payment gateway.');
        }
      }
    } else {
      console.warn('[Payment] Missing paymentUrl in response:', response);
      Alert.alert('Error', 'Payment gateway URL not found.');
    }
  } catch (error: any) {
    console.error('[Payment] Create order failed:', error);
    Alert.alert('Error', error.response?.data?.message || 'Failed to initiate payment');
  }
};

  const checkPaymentStatus = async (orderId: string) => {
    setPolling(true);
    try {
      const response = await getCashfreePaymentStatus(orderId);
      if (response.status === 'PAID') {
        Alert.alert('Success', 'Payment received successfully!');
        refetch();
      } else if (response.status === 'FAILED') {
        Alert.alert('Payment Failed', 'The payment transaction failed.');
      } else {
        Alert.alert('Payment Pending', 'If you completed the payment, it may take a few minutes to reflect.');
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
      <View style={styles.recordCard}>
        <TouchableOpacity 
          onPress={() => {
            setSelectedRecord(item);
            setShowTxnModal(true);
          }}
          activeOpacity={0.7}
          style={styles.recordHeader}
        >
          <Text style={styles.monthText}>{item.month}</Text>
          <View style={[styles.statusBadge, (styles as any)[`status_${item.status}`]]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.recordBody}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total Rent</Text>
            <Text style={styles.amountValue}>₹{item.totalRent}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Paid</Text>
            <Text style={[styles.amountValue, { color: '#4CAF50' }]}>₹{item.totalPaid}</Text>
          </View>
          {!isPaid && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Remaining</Text>
              <Text style={[styles.amountValue, { color: '#F44336' }]}>₹{item.remainingAmount}</Text>
            </View>
          )}
        </View>

        {!isPaid && (
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.payButton, { flex: 1, marginRight: 5 }]} 
              onPress={() => handlePayNow(item)}
              disabled={polling}
            >
              <Text style={styles.payButtonText}>Pay Online</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.manualButton, { flex: 1, marginLeft: 5 }]} 
              onPress={() => {
                setSelectedRecord(item);
                setManualForm({ ...manualForm, amount: item.remainingAmount.toString() });
                setShowManualModal(true);
              }}
            >
              <Text style={styles.manualButtonText}>Manual Pay</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.viewHistoryButton}
          onPress={() => {
            setSelectedRecord(item);
            setShowTxnModal(true);
          }}
        >
          <Text style={styles.viewHistoryText}>View Transactions</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ marginTop: 10 }}>Loading your payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={data?.rentRecords || []}
        renderItem={renderItem}
        // @ts-ignore
        estimatedItemSize={200}
        contentContainerStyle={{ padding: 15 }}
        refreshControl={
          <RefreshControl refreshing={isLoading || polling} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No payment records found.</Text>
            <TouchableOpacity 
              style={[styles.syncButton, mutationSync.isPending && styles.disabledButton]} 
              onPress={() => mutationSync.mutate()}
              disabled={mutationSync.isPending}
            >
              {mutationSync.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>Sync My Billing</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.syncHint}>Click sync if you just joined and don't see your bills yet.</Text>
          </View>
        }
      />

      {/* Transaction History Modal */}
      <Modal visible={showTxnModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Transactions - {selectedRecord?.month}</Text>
            
            {isLoadingDetail ? (
              <ActivityIndicator size="large" color="#2196F3" style={{ margin: 20 }} />
            ) : (
              <ScrollView style={styles.txnList}>
                {recordDetail?.transactions && recordDetail.transactions.length > 0 ? (
                  recordDetail.transactions.map((txn: PaymentTransaction) => (
                    <View key={txn._id} style={styles.txnItem}>
                      <View style={styles.txnMain}>
                        <Text style={styles.txnMethod}>{txn.paymentMethod.toUpperCase()}</Text>
                        <Text style={styles.txnDate}>{new Date(txn.paymentDate).toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.txnSecondary}>
                        <Text style={styles.txnAmount}>₹{txn.amount}</Text>
                        <View style={[styles.statusBadge, (styles as any)[`status_${txn.status}`]]}>
                          <Text style={styles.txnStatusText}>{txn.status.toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyTxnText}>No transactions found for this month.</Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => {
                setShowTxnModal(false);
                setSelectedRecord(null);
              }}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual Payment Modal */}
      <Modal visible={showManualModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Submit Manual Payment</Text>
            
            <Text style={styles.label}>Amount Paid</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={manualForm.amount}
              onChangeText={(text) => setManualForm({ ...manualForm, amount: text })}
            />

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodContainer}>
              {['upi', 'bank_transfer', 'cash', 'other'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodButton, manualForm.paymentMethod === m && styles.methodButtonActive]}
                  onPress={() => setManualForm({ ...manualForm, paymentMethod: m })}
                >
                  <Text style={[styles.methodButtonText, manualForm.paymentMethod === m && styles.methodButtonTextActive]}>
                    {m.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Transaction ID / Reference (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. UPI Ref Number"
              value={manualForm.transactionId}
              onChangeText={(text) => setManualForm({ ...manualForm, transactionId: text })}
            />

            <Text style={styles.label}>Note (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Additional info"
              value={manualForm.note}
              onChangeText={(text) => setManualForm({ ...manualForm, note: text })}
            />

            <Text style={styles.label}>Payment Proof (Optional)</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {proofImage ? (
                <Image source={{ uri: proofImage }} style={styles.previewImage} />
              ) : (
                <Text style={styles.imagePickerText}>Select Receipt Image</Text>
              )}
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setShowManualModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.submitButton]} 
                onPress={handleManualSubmit}
                disabled={mutationManual.isPending}
              >
                {mutationManual.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  status_paid: { backgroundColor: '#4CAF50' },
  status_partial: { backgroundColor: '#FF9800' },
  status_pending: { backgroundColor: '#2196F3' },
  status_overdue: { backgroundColor: '#F44336' },
  status_overpaid: { backgroundColor: '#9C27B0' },
  recordBody: {
    backgroundColor: 'transparent',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    backgroundColor: 'transparent',
  },
  amountLabel: {
    color: '#666',
    fontSize: 14,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 15,
    backgroundColor: 'transparent',
  },
  payButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  manualButton: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  manualButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 14,
  },
  viewHistoryButton: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  viewHistoryText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  txnList: {
    backgroundColor: 'transparent',
  },
  txnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'transparent',
  },
  txnMain: {
    backgroundColor: 'transparent',
  },
  txnMethod: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  txnDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  txnSecondary: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  txnBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txnStatusText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: 'bold',
  },
  txn_verified: { backgroundColor: '#4CAF50' },
  txn_pending: { backgroundColor: '#FF9800' },
  txn_rejected: { backgroundColor: '#F44336' },
  txn_reversed: { backgroundColor: '#9E9E9E' },
  emptyTxnText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  methodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'transparent',
  },
  methodButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
  },
  methodButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  methodButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  imagePicker: {
    height: 150,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePickerText: {
    color: '#999',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#eee',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    marginTop: 25,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#eee',
  },
  submitButton: {
    backgroundColor: '#2196F3',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  syncButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 150,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  syncHint: {
    color: '#999',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
