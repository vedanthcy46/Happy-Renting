import React, { useState, useMemo } from 'react';
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
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createComplaint, createComplaintFormData } from '../api/complaint';
import { cachedComplaints } from '../repositories';
import { Complaint } from '../types/complaint';
import { AppCard, AppButton, AppInput, StatusBadge, EmptyState, KeyboardSafeModal } from '../components';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { formatRelativeTime } from '../utils';

const COMPLAINT_CATEGORIES = [
  { id: 'plumbing', labelKey: 'plumbing', icon: 'water-outline' },
  { id: 'electrical', labelKey: 'electrical', icon: 'flash-outline' },
  { id: 'pest_control', labelKey: 'pestControl', icon: 'bug-outline' },
  { id: 'cleaning', labelKey: 'cleaning', icon: 'brush-outline' },
  { id: 'security', labelKey: 'security', icon: 'shield-outline' },
  { id: 'noise', labelKey: 'noise', icon: 'volume-high-outline' },
  { id: 'internet', labelKey: 'internet', icon: 'wifi-outline' },
  { id: 'other', labelKey: 'other', icon: 'ellipsis-horizontal-outline' },
];

export const ComplaintScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const priorityColors: Record<string, string> = {
    low: colors.success,
    medium: colors.warning,
    high: colors.error,
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', category: 'other' });
  const [imageUri, setImageUri] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['complaints'],
    queryFn: cachedComplaints,
  });

  const mutation = useMutation({
    mutationFn: createComplaint,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      setShowAddModal(false);
      setForm({ title: '', description: '', priority: 'medium', category: 'other' });
      setImageUri(null);
      const isQueued = typeof res?.complaint?._id === 'string' && res.complaint._id.startsWith('local-');
      if (isQueued) {
        Alert.alert(t('complaint.savedOfflineTitle'), t('complaint.savedOfflineDesc'));
      }
    },
    onError: (error: any) => Alert.alert(t('common.error'), error.response?.data?.message || t('complaint.failedSubmit')),
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleCreate = () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert(t('common.error'), t('complaint.titleDescRequired'));
      return;
    }

    const formData = createComplaintFormData({
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      category: form.category,
      imageUri: imageUri || undefined,
    });

    mutation.mutate(formData as any);
  };

  const renderItem = ({ item }: { item: Complaint }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: '/complaintDetail/[id]', params: { id: item._id } })}
    >
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
              <Text style={styles.resolutionLabel}>{t('complaint.resolution')}</Text>
            </View>
            <Text style={styles.resolutionText}>{item.resolutionNotes}</Text>
          </View>
        )}
      </AppCard>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('complaint.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('complaint.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.headerAddText}>{t('common.add')}</Text>
        </TouchableOpacity>
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
            title={t('complaint.noComplaintsTitle')}
            description={t('complaint.noComplaintsDesc')}
            actionLabel={t('complaint.addComplaint')}
            onAction={() => setShowAddModal(true)}
          />
        }
      />

      <KeyboardSafeModal
        visible={showAddModal}
        animationType="slide"
        overlayStyle={[styles.modalOverlay, { paddingBottom: insets.bottom + 64 }]}
        onRequestClose={() => setShowAddModal(false)}
      >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{t('complaint.addComplaint')}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <AppInput
                label={t('complaint.titleLabel')}
                placeholder={t('complaint.titlePlaceholderEx')}
                value={form.title}
                onChangeText={(text) => setForm({ ...form, title: text })}
              />

              <Text style={styles.fieldLabel}>{t('complaint.description')}</Text>
              <TextInput
                style={styles.textArea}
                placeholder={t('complaint.descriptionPlaceholderEx')}
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={4}
                value={form.description}
                onChangeText={(text) => setForm({ ...form, description: text })}
              />

              <Text style={styles.fieldLabel}>{t('complaint.priority')}</Text>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, form.priority === p && { backgroundColor: priorityColors[p], borderColor: priorityColors[p] }]}
                    onPress={() => setForm({ ...form, priority: p })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.priorityChipText, form.priority === p && { color: '#FFFFFF' }]}>
                      {t(`complaint.${p}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('complaint.category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                {COMPLAINT_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.categoryChip, form.category === c.id && styles.categoryChipActive]}
                    onPress={() => setForm({ ...form, category: c.id })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={c.icon as any} size={16} color={form.category === c.id ? '#FFFFFF' : colors.text.secondary} />
                    <Text style={[styles.categoryChipText, form.category === c.id && { color: '#FFFFFF' }]}>
                      {t(`complaint.${c.labelKey}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>{t('complaint.photoAttachment')}</Text>
              {imageUri ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.attachedImage} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  <Text style={styles.attachBtnText}>{t('complaint.addPhotoProof')}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalButtons}>
                <AppButton title={t('common.cancel')} onPress={() => setShowAddModal(false)} variant="ghost" style={{ flex: 1, marginRight: spacing.sm }} />
                <AppButton title={t('common.submit')} onPress={handleCreate} loading={mutation.isPending} style={{ flex: 1, marginLeft: spacing.sm }} />
              </View>
            </ScrollView>
          </View>
      </KeyboardSafeModal>
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.md,
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
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerAddText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
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
  categoryRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
    paddingVertical: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: spacing.xxl,
    width: 120,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  attachedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    marginBottom: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  attachBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
