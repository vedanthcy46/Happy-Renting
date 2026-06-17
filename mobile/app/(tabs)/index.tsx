import { StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Platform, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Text, View } from '@/components/Themed';
import { getMyTenancy, addRoommate, updateRoommate, deleteRoommate } from '../../src/api/tenant';
import { getRentRecords } from '../../src/api/payment';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [showRoommateModal, setShowRoommateModal] = useState(false);
  const [editingRoommate, setEditingRoommate] = useState<any>(null);
  const [roommateForm, setRoommateForm] = useState({ name: '', phone: '', idProof: '' });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['myTenancy'],
    queryFn: getMyTenancy,
  });

  const { data: rentData, isLoading: isLoadingRent } = useQuery({
    queryKey: ['rentRecords'],
    queryFn: getRentRecords,
  });

  const tenant = data?.tenant;
  const latestRecord = rentData?.rentRecords?.[0];

  const mutationAdd = useMutation({
    mutationFn: (data: any) => addRoommate(tenant!._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenancy'] });
      setShowRoommateModal(false);
      setRoommateForm({ name: '', phone: '', idProof: '' });
      Alert.alert('Success', 'Roommate added successfully');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to add roommate'),
  });

  const mutationUpdate = useMutation({
    mutationFn: (data: any) => updateRoommate(tenant!._id, editingRoommate._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenancy'] });
      setShowRoommateModal(false);
      setEditingRoommate(null);
      setRoommateForm({ name: '', phone: '', idProof: '' });
      Alert.alert('Success', 'Roommate updated successfully');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to update roommate'),
  });

  const mutationDelete = useMutation({
    mutationFn: (coId: string) => deleteRoommate(tenant!._id, coId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenancy'] });
      Alert.alert('Success', 'Roommate removed successfully');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to remove roommate'),
  });

  const handleSaveRoommate = () => {
    if (!roommateForm.name || !roommateForm.phone) {
      Alert.alert('Error', 'Name and phone are required');
      return;
    }
    if (editingRoommate) {
      mutationUpdate.mutate(roommateForm);
    } else {
      mutationAdd.mutate(roommateForm);
    }
  };

  const confirmDeleteRoommate = (co: any) => {
    Alert.alert(
      'Remove Roommate',
      `Are you sure you want to remove ${co.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => mutationDelete.mutate(co._id) },
      ]
    );
  };

  const handleCallOwner = () => {
    if (tenant?.ownerId?.phone) {
      Linking.openURL(`tel:${tenant.ownerId.phone}`);
    }
  };

  const onRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
  };

  if (isLoading || isLoadingRent) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ marginTop: 10 }}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (isError || !tenant || tenant.status === 'vacated') {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 20 }}>🚪</Text>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' }}>
          {tenant?.status === 'vacated' ? 'Tenancy Ended' : 'No Active Tenancy'}
        </Text>
        <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 }}>
          {isError ? 'Failed to load data.' : 
           (tenant?.status === 'vacated' 
            ? `Your stay at Room ${tenant.roomId?.roomNumber || ''} concluded on ${tenant.exitDate ? new Date(tenant.exitDate).toLocaleDateString() : 'an unknown date'}.`
            : 'You haven\'t been assigned to a room yet. Contact an owner to get added.')}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry / Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading || isLoadingRent} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <TouchableOpacity 
          style={styles.bellIcon} 
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      {latestRecord ? (
        <View style={[styles.card, styles.highlightCard]}>
          <View style={styles.highlightHeader}>
            <Text style={styles.highlightTitle}>Current Bill - {latestRecord.month}</Text>
            <View style={[styles.statusBadge, (styles as any)[`status_${latestRecord.status}`]]}>
              <Text style={styles.statusText}>{latestRecord.status.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.highlightBody}>
            <Text style={styles.highlightAmount}>₹{latestRecord.remainingAmount}</Text>
            <Text style={styles.highlightLabel}>Remaining Balance</Text>
          </View>
          {latestRecord.status !== 'paid' && latestRecord.status !== 'overpaid' && (
            <TouchableOpacity 
              style={styles.payNowButton} 
              onPress={() => Alert.alert('Payment', 'Please go to the Payments tab to pay.')}
            >
              <Text style={styles.payNowButtonText}>View Payment Options</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[styles.card, styles.highlightCard]}>
          <Text style={styles.highlightTitle}>Current Billing Status</Text>
          <View style={styles.highlightBody}>
            <Text style={styles.noBillText}>No bills generated yet.</Text>
            <Text style={styles.highlightLabel}>Bills are generated on the 5th of each month.</Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Room</Text>
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.label}>Property</Text>
            <Text style={styles.value}>{tenant.propertyId.name}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Room No.</Text>
            <Text style={styles.value}>{tenant.roomId.roomNumber}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.label}>Monthly Rent</Text>
            <Text style={styles.value}>₹{tenant.roomId.monthlyRent}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Rent Due Day</Text>
            <Text style={styles.value}>5th of month</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderWithAction}>
          <Text style={styles.cardTitle}>Roommates</Text>
          <TouchableOpacity 
            style={styles.addAction} 
            onPress={() => {
              setEditingRoommate(null);
              setRoommateForm({ name: '', phone: '', idProof: '' });
              setShowRoommateModal(true);
            }}
          >
            <Text style={styles.addActionText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        
        {tenant.coOccupants && tenant.coOccupants.length > 0 ? (
          tenant.coOccupants.map((co: any) => (
            <View key={co._id} style={styles.roommateItem}>
              <View style={styles.roommateInfo}>
                <Text style={styles.roommateName}>{co.name}</Text>
                <Text style={styles.roommatePhone}>{co.phone}</Text>
              </View>
              <View style={styles.roommateActions}>
                <TouchableOpacity 
                  onPress={() => {
                    setEditingRoommate(co);
                    setRoommateForm({ name: co.name, phone: co.phone, idProof: co.idProof || '' });
                    setShowRoommateModal(true);
                  }}
                  style={styles.iconButton}
                >
                  <Text style={styles.editIcon}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => confirmDeleteRoommate(co)}
                  style={styles.iconButton}
                >
                  <Text style={styles.deleteIcon}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No roommates added.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Owner Details</Text>
        <Text style={styles.ownerName}>{tenant.ownerId.name}</Text>
        <TouchableOpacity style={styles.contactButton} onPress={handleCallOwner}>
          <Text style={styles.contactButtonText}>Call Owner: {tenant.ownerId.phone}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Financials</Text>
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.label}>Security Deposit</Text>
            <Text style={styles.value}>₹{tenant.securityDeposit}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Advance Paid</Text>
            <Text style={styles.value}>₹{tenant.advancePaid}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.joinedText}>
          Joined on {new Date(tenant.joinDate).toLocaleDateString()}
        </Text>
      </View>

      <Modal visible={showRoommateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingRoommate ? 'Edit Roommate' : 'Add Roommate'}
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={roommateForm.name}
              onChangeText={(text) => setRoommateForm({ ...roommateForm, name: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone"
              keyboardType="phone-pad"
              value={roommateForm.phone}
              onChangeText={(text) => setRoommateForm({ ...roommateForm, phone: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="ID Proof (Optional)"
              value={roommateForm.idProof}
              onChangeText={(text) => setRoommateForm({ ...roommateForm, idProof: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setShowRoommateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.submitButton]} 
                onPress={handleSaveRoommate}
              >
                <Text style={styles.submitButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    padding: 20,
  },
  header: {
    padding: 20,
    backgroundColor: '#2196F3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bellIcon: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  welcomeText: {
    fontSize: 16,
    color: '#E3F2FD',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  card: {
    margin: 15,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  highlightCard: {
    backgroundColor: '#fff',
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3',
  },
  highlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  highlightBody: {
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: 'transparent',
  },
  highlightAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  highlightLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  noBillText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  payNowButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  payNowButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addAction: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addActionText: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 12,
  },
  roommateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'transparent',
  },
  roommateInfo: {
    backgroundColor: 'transparent',
  },
  roommateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  roommatePhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  roommateActions: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
  },
  editIcon: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteIcon: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 15,
    backgroundColor: 'transparent',
  },
  column: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  ownerName: {
    fontSize: 18,
    color: '#333',
    marginBottom: 15,
    marginTop: 15,
  },
  contactButton: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  joinedText: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
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
});
