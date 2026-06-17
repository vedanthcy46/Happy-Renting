import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Text, View } from '@/components/Themed';
import { getComplaints, createComplaint } from '../../src/api/complaint';
import { Complaint } from '../../src/types/complaint';

export default function ComplaintsScreen() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['complaints'],
    queryFn: getComplaints,
  });

  const mutation = useMutation({
    mutationFn: createComplaint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      setShowAddModal(false);
      setForm({ title: '', description: '', priority: 'medium' });
      Alert.alert('Success', 'Complaint raised successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to raise complaint');
    },
  });

  const handleCreate = () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert('Error', 'Please fill in title and description');
      return;
    }
    mutation.mutate(form);
  };

  const renderItem = ({ item }: { item: Complaint }) => (
    <View style={styles.complaintCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.complaintTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, (styles as any)[`status_${item.status}`]]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.complaintDesc}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.priorityText}>Priority: {item.priority.toUpperCase()}</Text>
        <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      {item.resolutionNotes && (
        <View style={styles.resolutionBox}>
          <Text style={styles.resolutionLabel}>Resolution Notes:</Text>
          <Text style={styles.resolutionNotes}>{item.resolutionNotes}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={data?.complaints || []}
        renderItem={renderItem}
        // @ts-ignore
        estimatedItemSize={150}
        contentContainerStyle={{ padding: 15 } as any}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No complaints raised yet.</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Raise Complaint</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Title (e.g., Leaking Tap)"
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              multiline
              numberOfLines={4}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
            />

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityContainer}>
              {['low', 'medium', 'high'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    form.priority === p && styles.priorityButtonActive,
                  ]}
                  onPress={() => setForm({ ...form, priority: p })}
                >
                  <Text style={[
                    styles.priorityButtonText,
                    form.priority === p && styles.priorityButtonTextActive,
                  ]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.submitButton]} 
                onPress={handleCreate}
                disabled={mutation.isPending}
              >
                <Text style={styles.submitButtonText}>
                  {mutation.isPending ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  complaintCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  status_pending: { backgroundColor: '#FF9800' },
  status_resolved: { backgroundColor: '#4CAF50' },
  status_closed: { backgroundColor: '#9E9E9E' },
  status_in_progress: { backgroundColor: '#2196F3' },
  complaintDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  priorityText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
  },
  resolutionBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
  },
  resolutionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  resolutionNotes: {
    fontSize: 13,
    color: '#388E3C',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabIcon: {
    fontSize: 30,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#666',
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    backgroundColor: 'transparent',
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  priorityButtonTextActive: {
    color: '#fff',
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});
