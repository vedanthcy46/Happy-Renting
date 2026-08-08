import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, RefreshControl, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, shadows } from '../../theme';
import { getComplaintDetail, addComplaintComment } from '../../api/complaint';
import { updateComplaint } from '../../api/owner';
import type { Complaint } from '../../types/complaint';

const STATUS_CFG = (colors: any, t: any): Record<string, { bg: string; text: string; label: string }> => ({
  pending: { bg: colors.warningLight, text: colors.warning, label: t('owner.complaintDetail.statusOpen') },
  'in-progress': { bg: colors.infoLight, text: colors.info, label: t('owner.complaintDetail.statusInProgress') },
  resolved: { bg: colors.successLight, text: colors.success, label: t('owner.complaintDetail.statusResolved') },
  rejected: { bg: colors.errorLight, text: colors.error, label: t('owner.complaintDetail.statusRejected') },
  closed: { bg: colors.borderLight, text: colors.text.secondary, label: t('owner.complaintDetail.statusClosed') },
});

const PRIORITY_CFG = (colors: any, t: any): Record<string, { bg: string; text: string; label: string }> => ({
  low: { bg: colors.successLight, text: colors.success, label: t('owner.complaints.priorityLow') },
  medium: { bg: colors.infoLight, text: colors.info, label: t('owner.complaints.priorityMedium') },
  high: { bg: colors.warningLight, text: colors.warning, label: t('owner.complaints.priorityHigh') },
  urgent: { bg: colors.errorLight, text: colors.error, label: t('owner.complaints.priorityUrgent') },
});

const formatDateTime = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const TERMINAL = new Set(['resolved', 'closed', 'rejected']);

export const OwnerComplaintDetailScreen: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ownerComplaintDetail', id],
    queryFn: () => getComplaintDetail(id),
    staleTime: 0,
  });

  const complaint: Complaint | undefined = data?.complaint;

  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [message, setMessage] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardOffset(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardOffset(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 8000);
    return () => clearInterval(interval);
  }, [refetch]);

  const scrollRef = useRef<ScrollView>(null);

  const updateMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) =>
      updateComplaint(id, { status, resolutionNotes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerComplaintDetail', id] });
      qc.invalidateQueries({ queryKey: ['ownerComplaints'] });
      setNewStatus(null);
      setResolutionNotes('');
    },
    onError: (err: any) => {
      if (__DEV__) console.error('Update failed', err);
    },
  });

  const commentMutation = useMutation({
    mutationFn: (msg: string) => addComplaintComment(id, msg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ownerComplaintDetail', id] });
    },
    onError: (err: any) => {
      if (__DEV__) console.error('Comment failed', err);
    },
  });

  const isTerminal = complaint ? TERMINAL.has(complaint.status) : false;

  const statusOptions = [
    { key: 'in-progress', label: t('owner.complaintDetail.statusInProgress') },
    { key: 'resolved', label: t('owner.complaintDetail.statusResolved') },
    { key: 'rejected', label: t('owner.complaintDetail.statusRejected') },
  ];

  const commentCount = complaint?.comments?.length ?? 0;
  const lastMessage = commentCount > 0 ? complaint!.comments![commentCount - 1].message : '';

  const sendComment = useCallback(() => {
    const msg = message.trim();
    if (!msg) return;
    commentMutation.mutate(msg, { onSuccess: () => setMessage('') });
  }, [message, commentMutation]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !complaint) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('owner.complaintDetail.errLoad')}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()} activeOpacity={0.8}>
          <Text style={styles.retryText}>{t('owner.complaintDetail.btnRetry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sc = STATUS_CFG(colors, t)[complaint.status] ?? { bg: colors.borderLight, text: colors.text.secondary, label: complaint.status };
  const pc = PRIORITY_CFG(colors, t)[complaint.priority] ?? { bg: colors.borderLight, text: colors.text.secondary, label: complaint.priority };
  const statusBtnDisabled = !newStatus || (newStatus !== 'in-progress' && !resolutionNotes.trim());

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]} numberOfLines={1}>{t('owner.complaintDetail.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>{formatDate(complaint.createdAt)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.badgeText, { color: sc.text }]}>{sc.label}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: spacing.xxl + keyboardOffset }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {/* Details card */}
          <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
            <Text style={[styles.title, { color: colors.text.primary }]}>{complaint.title}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: pc.bg }]}>
                 <Text style={[styles.badgeText, { color: pc.text }]}>{t('owner.complaintDetail.badgePrioritySuffix', { label: pc.label })}</Text>
              </View>
              {complaint.category ? (
                <View style={[styles.badge, { backgroundColor: colors.borderLight }]}>
                  <Text style={[styles.badgeText, { color: colors.text.secondary }]}>{complaint.category}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.desc, { color: colors.text.primary }]}>{complaint.description}</Text>
            {complaint.resolutionNotes ? (
              <View style={[styles.notesBox, { backgroundColor: colors.successLight }]}>
                 <Text style={[styles.notesLabel, { color: colors.success }]}>{t('owner.complaintDetail.resolutionNotes')}</Text>
                <Text style={[styles.notesText, { color: colors.text.primary }]}>{complaint.resolutionNotes}</Text>
              </View>
            ) : null}
          </View>

          {/* Status update panel (owner) */}
          {!isTerminal && (
            <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('owner.complaintDetail.sectionUpdateStatus')}</Text>
              <View style={styles.statusRow}>
                {statusOptions.map(opt => {
                  const selected = newStatus === opt.key;
                  const cfg = STATUS_CFG(colors, t)[opt.key] ?? {};
                  const color = selected ? cfg.text ?? colors.primary : colors.text.secondary;
                  const border = selected ? cfg.bg ?? colors.primary : colors.border;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.statusChip, { borderColor: border, backgroundColor: selected ? (cfg.bg ?? colors.borderLight) : colors.background }]}
                      onPress={() => { setNewStatus(opt.key); if (opt.key === 'in-progress') setResolutionNotes(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.statusChipText, { color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {newStatus && newStatus !== 'in-progress' && (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.complaintDetail.fieldResolutionNotes')}</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={resolutionNotes}
                    onChangeText={setResolutionNotes}
                    placeholder={t('owner.complaintDetail.placeholderResolution')}
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                  />
                </View>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: newStatus && !updateMutation.isPending && statusBtnDisabled ? colors.border : colors.primary }]}
                onPress={() => newStatus && updateMutation.mutate({ status: newStatus, notes: resolutionNotes.trim() })}
                activeOpacity={0.8}
                disabled={!newStatus || updateMutation.isPending || statusBtnDisabled}
              >
                {updateMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> :                  <Text style={styles.saveBtnText}>{t('owner.complaintDetail.btnUpdateStatus')}</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Chat */}
          <View style={[styles.section, { backgroundColor: colors.surface }, shadows.sm]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {t('owner.complaintDetail.sectionComments', { count: commentCount })}
            </Text>
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {(complaint.comments ?? []).map(c => {
                const own = c.authorRole === 'owner' || c.authorRole === 'superadmin';
                return (
                  <View key={c._id} style={[styles.bubbleWrap, own ? styles.bubbleOwn : styles.bubbleOther]}>
                    <View style={[styles.bubble, own ? { backgroundColor: colors.primary } : { backgroundColor: colors.borderLight }]}>
                      <Text style={[styles.bubbleName, { color: own ? 'rgba(255,255,255,0.85)' : colors.text.secondary }]}>{c.authorName}</Text>
                      <Text style={[styles.bubbleText, { color: own ? '#FFFFFF' : colors.text.primary }]}>{c.message}</Text>
                    </View>
                    <Text style={[styles.bubbleTime, { color: colors.text.tertiary }]}>{formatTime(c.createdAt)}</Text>
                  </View>
                );
              })}
              {complaint.comments?.length === 0 && (
                 <Text style={[styles.noComments, { color: colors.text.tertiary }]}>{t('owner.complaintDetail.noComments')}</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Comment composer */}
        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm, bottom: keyboardOffset }]}>
          <TextInput
            style={[styles.composerInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
            value={message}
            onChangeText={setMessage}
            placeholder={isTerminal ? t('owner.complaintDetail.composerClosed') : t('owner.complaintDetail.composerReply')}
            placeholderTextColor={colors.text.tertiary}
            multiline
            editable={!isTerminal}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: isTerminal || !message.trim() ? colors.border : colors.primary }]}
            onPress={sendComment}
            activeOpacity={0.8}
            disabled={isTerminal || !message.trim() || commentMutation.isPending}
          >
            {commentMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: radius.full },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  section: { margin: spacing.xl, marginBottom: 0, marginTop: spacing.lg, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  desc: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  notesBox: { padding: spacing.md, borderRadius: radius.md, marginTop: spacing.xs },
  notesLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.xs },
  notesText: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
  statusRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  statusChip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  statusChipText: { fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  saveBtn: { height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  bubbleWrap: { maxWidth: '80%', gap: 2 },
  bubbleOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  bubbleName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 2 },
  emptyComments: { fontSize: 13, color: 'inherit' },
  noComments: { fontSize: 13, textAlign: 'center', paddingVertical: spacing.sm },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingTop: spacing.md, paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1, borderWidth: 1, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 14, maxHeight: 100,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});