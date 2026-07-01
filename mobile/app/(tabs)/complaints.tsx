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
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { getComplaints, createComplaint } from '../../src/api/complaint';
import { Complaint } from '../../src/types/complaint';
import { AppCard, AppButton, AppInput, StatusBadge, EmptyState, AppHeader } from '../../src/components';
import { colors, typography, spacing, radius } from '../../src/theme';
import { formatRelativeTime } from '../../src/utils';

const priorityColors: Record<string, string> = {
  low: colors.success,
  medium: colors.warning,
  high: colors.error,
};

export default function ComplaintsScreen() {
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
      setForm({ title: '', description: '', priority: 'medium' });
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed'),
  });

  const handleCreate = () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert('Error', 'Title and description are required');
      return;
    }
    mutation.mutate(form);
  };

  const renderItem = ({ item }: { item: Complaint }) => (
    <AppCard style={styles.complaintCard} variant="elevated">
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
      <AppHeader
        title="Complaints"
        subtitle="Track and manage issues"
        style={{ paddingTop: insets.top + spacing.md }}
      />

      <FlashList
        data={data?.complaints || []}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No Complaints"
            description="No issues raised yet. Tap + to raise a complaint."
          />
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Raise a Complaint</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

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
                  style={[
                    styles.priorityChip,
                    form.priority === p && { backgroundColor: priorityColors[p], borderColor: priorityColors[p] },
                  ]}
                  onPress={() => setForm({ ...form, priority: p })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.priorityChipText,
                    form.priority === p && { color: '#FFFFFF' },
                  ]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <AppButton title="Cancel" onPress={() => setShowAddModal(false)} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
              <AppButton
                title="Submit"
                onPress={handleCreate}
                loading={mutation.isPending}
                style={{ flex: 1, marginLeft: spacing.sm }}
              />
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
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  complaintCard: {
    marginBottom: spacing.lg,
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
    ...typography.caption,
    color: colors.text.tertiary,
  },
  complaintTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  complaintDesc: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 21,
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
  },
  resolutionLabel: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  resolutionText: {
    ...typography.bodySmall,
    color: colors.success,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
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
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
    maxHeight: '85%',
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
  fieldLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.xl,
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
    ...typography.buttonSmall,
    color: colors.text.secondary,
  },
  modalButtons: {
    flexDirection: 'row',
  },
});


