import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getComplaints, createComplaint } from '../api/complaint';
import { Complaint } from '../types/complaint';
import { AppCard, AppButton, AppInput, StatusBadge, EmptyState } from '../components';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { formatRelativeTime } from '../utils';

const priorityColors: Record<string, string> = {
  low: colors.success,
  medium: colors.warning,
  high: colors.error,
};

export const ComplaintScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['complaints'],
    queryFn: getComplaints,
  });

  const mutation = useMutation({
    mutationFn: createComplaint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      setShowAddModal(false);
              setForm({ title: '', description: '', priority: 'medium' as string });
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to submit complaint'),
  });

  const handleCreate = () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert('Error', 'Title and description are required');
      return;
    }
    mutation.mutate(form);
  };

  const renderItem = ({ item }: { item: Complaint }) => (
    <AppCard variant="elevated" style={styles.complaintCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <StatusBadge status={item.status} />
          <View style={[styles.priorityDot, { backgroundColor: priorityColors[item.priority] || colors.text.tertiary }]} />
        </View>
        <Text style={styles.dateText}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.complaintTitle}>{item.title}</Text>
      <Text style={styles.complaintDesc} numberOfLines={3}>{item.description}</Text>
      {item.resolutionNotes && (
        <View style={styles.resolutionBox}>
          <View style={styles.resolutionHeader}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.resolutionLabel}>Resolution</Text>
          </View>
          <Text style={styles.resolutionText}>{item.resolutionNotes}</Text>
        </View>
      )}
    </AppCard>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.headerTitle}>Complaints</Text>
        <Text style={styles.headerSubtitle}>Track and manage issues</Text>
      </View>

      <FlashList
        data={data?.complaints || []}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No Complaints"
            description="No issues raised yet. Tap + to raise a complaint."
            actionLabel="Raise a Complaint"
            onAction={() => setShowAddModal(true)}
          />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Raise a Complaint</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppInput
                label="Title"
                placeholder="e.g. Leaking Tap"
                value={form.title}
                onChangeText={(text) => setForm({ ...form, title: text })}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the issue in detail..."
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={4}
                value={form.description}
                onChangeText={(text) => setForm({ ...form, description: text })}
              />

              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, form.priority === p && { backgroundColor: priorityColors[p], borderColor: priorityColors[p] }]}
                    onPress={() => setForm({ ...form, priority: p })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.priorityChipText, form.priority === p && { color: '#FFFFFF' }]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <AppButton title="Cancel" onPress={() => setShowAddModal(false)} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
                <AppButton title="Submit" onPress={handleCreate} loading={mutation.isPending} style={{ flex: 1, marginLeft: spacing.sm }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  complaintCard: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  complaintDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  resolutionBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  resolutionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  resolutionText: {
    fontSize: 13,
    color: colors.success,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl + 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
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
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
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
  textArea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
});
