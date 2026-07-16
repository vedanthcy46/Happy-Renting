import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getComplaintDetail, addComplaintComment } from '../api/complaint';
import { StatusBadge, AppCard } from '../components';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { formatDate, formatRelativeTime } from '../utils';
import { useAuthStore } from '../store/useAuthStore';

interface ComplaintDetailScreenProps {
  complaintId: string;
  onBack: () => void;
}

export const ComplaintDetailScreen: React.FC<ComplaintDetailScreenProps> = ({ complaintId, onBack }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const priorityColors: Record<string, { bg: string; text: string }> = {
    low: { bg: colors.successLight, text: colors.success },
    medium: { bg: colors.warningLight, text: colors.warning },
    high: { bg: colors.errorLight, text: colors.error },
    urgent: { bg: colors.errorLight, text: colors.error },
  };
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const commentsScrollRef = useRef<ScrollView>(null);
  const [message, setMessage] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['complaintDetail', complaintId],
    queryFn: () => getComplaintDetail(complaintId),
    refetchInterval: 5000, // Poll every 5 seconds for real-time messages
  });

  const commentMutation = useMutation({
    mutationFn: (msg: string) => addComplaintComment(complaintId, msg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaintDetail', complaintId] });
      setMessage('');
      setTimeout(() => {
        commentsScrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit comment');
    },
  });

  const handleSendComment = () => {
    if (!message.trim()) return;
    commentMutation.mutate(message.trim());
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const complaint = data?.complaint;

  if (!complaint) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>Complaint not found</Text>
        <TouchableOpacity style={styles.backButtonBtn} onPress={onBack}>
          <Text style={styles.backButtonBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const priorityStyle = priorityColors[complaint.priority] || { bg: colors.borderLight, text: colors.text.secondary };

  // Determine visual steps
  const steps = [
    { label: 'Submitted', key: 'pending' },
    { label: 'Assigned', key: 'assigned' },
    { label: 'In Progress', key: 'in_progress' },
    { label: complaint.status === 'rejected' ? 'Rejected' : 'Resolved', key: 'resolved' },
  ];

  let currentStepIndex = 0;
  if (complaint.status === 'in-progress') {
    currentStepIndex = 2; // Submitted -> Assigned -> In Progress
  } else if (['resolved', 'rejected', 'closed'].includes(complaint.status)) {
    currentStepIndex = 3; // Submitted -> Assigned -> In Progress -> Resolved/Rejected
  } else if (complaint.status === 'pending') {
    currentStepIndex = 0; // Just submitted
  } else {
    // default/fallback
    currentStepIndex = 1; 
  }

  const isClosed = ['resolved', 'closed', 'rejected'].includes(complaint.status);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Custom Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>Complaint Details</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.iconButton} activeOpacity={0.7}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Timeline Indicator */}
        <AppCard variant="default" style={{ marginBottom: 24 }}>
          <Text style={styles.sectionHeaderTitle}>Status Progress</Text>
          <View style={styles.timelineWrapper}>
            {/* Background Line */}
            <View style={styles.lineBackground} />
            {/* Colored Fill Line */}
            <View
              style={[
                styles.lineFill,
                {
                  width:
                    currentStepIndex === 0
                      ? '0%'
                      : currentStepIndex === 1
                      ? '25%'
                      : currentStepIndex === 2
                      ? '50%'
                      : '75%',
                },
              ]}
            />

            {steps.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <View key={step.key} style={styles.stepContainer}>
                  <View
                    style={[
                      styles.dotContainer,
                      isCompleted ? styles.dotCompleted : styles.dotPending,
                      isCurrent && styles.dotCurrent,
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    ) : (
                      <View style={styles.dotInnerPending} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isCompleted ? styles.stepLabelActive : styles.stepLabelInactive,
                      isCurrent && styles.stepLabelCurrent,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </AppCard>

        {/* Complaint Info */}
        <AppCard variant="elevated" style={styles.infoCard}>
          <View style={styles.badgeRow}>
            <StatusBadge status={complaint.status} />
            <View style={[styles.customBadge, { backgroundColor: priorityStyle.bg }]}>
              <Text style={[styles.customBadgeText, { color: priorityStyle.text }]}>
                {complaint.priority.toUpperCase()}
              </Text>
            </View>
            {complaint.category && (
              <View style={[styles.customBadge, styles.categoryBadge]}>
                <Text style={styles.categoryBadgeText}>{complaint.category}</Text>
              </View>
            )}
          </View>

          <Text style={styles.complaintTitle}>{complaint.title}</Text>
          <Text style={styles.createdAtText}>Raised on {formatDate(complaint.createdAt)}</Text>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.descriptionText}>{complaint.description}</Text>

          {/* Attachments */}
          {complaint.images && complaint.images.length > 0 && (
            <View style={styles.attachmentsSection}>
              <Text style={styles.sectionLabel}>Attachments</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesScroll}>
                {complaint.images.map((imgUri, index) => (
                  <Image
                    key={index}
                    source={{ uri: imgUri }}
                    style={styles.attachmentImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Resolution Notes */}
          {complaint.resolutionNotes && (
            <View style={styles.resolutionBox}>
              <View style={styles.resolutionHeader}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.resolutionLabel}>Resolution Notes</Text>
              </View>
              <Text style={styles.resolutionText}>{complaint.resolutionNotes}</Text>
              {complaint.resolvedAt && (
                <Text style={styles.resolvedAtText}>
                  Resolved at {formatDate(complaint.resolvedAt)}
                </Text>
              )}
            </View>
          )}
        </AppCard>

        {/* Comments Section */}
        <AppCard variant="default" style={styles.commentsContainer}>
          <Text style={styles.commentsTitle}>Comments & Updates</Text>
          <ScrollView 
            ref={commentsScrollRef}
            style={{ maxHeight: 350 }} 
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            onContentSizeChange={() => commentsScrollRef.current?.scrollToEnd({ animated: false })}
          >
            {(!complaint.comments || complaint.comments.length === 0) ? (
              <View style={styles.noCommentsBox}>
                <Ionicons name="chatbubble-outline" size={24} color={colors.text.tertiary} />
                <Text style={styles.noCommentsText}>No updates or comments yet.</Text>
              </View>
            ) : (
              complaint.comments.map((comment) => {
                const isOwn = user?.role ? comment.authorRole === user.role : comment.authorRole === 'tenant';
                return (
                  <View
                    key={comment._id}
                    style={[
                      styles.commentBubbleWrapper,
                      isOwn ? styles.commentRight : styles.commentLeft,
                    ]}
                  >
                    <View
                      style={[
                        styles.commentBubble,
                        isOwn ? styles.bubbleOwn : styles.bubbleOther,
                      ]}
                    >
                      <View style={styles.commentHeader}>
                        <Text style={[styles.authorName, isOwn ? styles.textWhite : styles.textPrimary]}>
                          {comment.authorName}
                        </Text>
                        <View style={[styles.roleLabel, isOwn ? styles.roleOwn : styles.roleOther]}>
                          <Text style={isOwn ? styles.roleOwnText : styles.roleOtherText}>{comment.authorRole.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={[styles.commentMessage, isOwn ? styles.textWhite : styles.textPrimary]}>
                        {comment.message}
                      </Text>
                      <Text style={[styles.commentTime, isOwn ? styles.timeLight : styles.timeDark]}>
                        {formatRelativeTime(comment.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </AppCard>
      </ScrollView>

      {/* Comment Input Footer */}
      <View style={[styles.inputFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TextInput
          style={[styles.textInput, isClosed && { opacity: 0.6 }]}
          placeholder={isClosed ? "This complaint is closed." : "Add a follow-up message..."}
          placeholderTextColor={colors.text.tertiary}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          editable={!isClosed}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!message.trim() || isClosed) && styles.sendButtonDisabled]}
          onPress={handleSendComment}
          disabled={!message.trim() || commentMutation.isPending || isClosed}
          activeOpacity={0.8}
        >
          {commentMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  backButtonBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  backButtonBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  iconButton: {
    padding: spacing.xs,
  },
  topBarTitle: {
    ...typography.h4,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  timelineCard: {
    marginBottom: spacing.lg,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xs,
  },
  lineBackground: {
    position: 'absolute',
    top: 12,
    left: '12.5%',
    right: '12.5%',
    height: 3,
    backgroundColor: colors.border,
    zIndex: 1,
  },
  lineFill: {
    position: 'absolute',
    top: 12,
    left: '12.5%',
    height: 3,
    backgroundColor: colors.success,
    zIndex: 2,
  },
  stepContainer: {
    alignItems: 'center',
    width: '25%',
    zIndex: 3,
  },
  dotContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    marginBottom: spacing.xs,
  },
  dotCompleted: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  dotPending: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dotCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dotInnerPending: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.tertiary,
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  stepLabelActive: {
    color: colors.text.primary,
  },
  stepLabelInactive: {
    color: colors.text.tertiary,
  },
  stepLabelCurrent: {
    color: colors.primary,
    fontWeight: '700',
  },
  infoCard: {
    marginBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  customBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: colors.borderLight,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  complaintTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  createdAtText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  attachmentsSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  imagesScroll: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  attachmentImage: {
    width: 140,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.borderLight,
  },
  resolutionBox: {
    backgroundColor: colors.successLight,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.success + '20',
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  resolutionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
  resolutionText: {
    fontSize: 14,
    color: colors.success,
    lineHeight: 20,
  },
  resolvedAtText: {
    fontSize: 11,
    color: colors.success,
    opacity: 0.8,
    marginTop: spacing.sm,
  },
  commentsContainer: {
    marginTop: spacing.md,
  },
  commentsTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  noCommentsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noCommentsText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  commentBubbleWrapper: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    width: '100%',
  },
  commentLeft: {
    justifyContent: 'flex-start',
  },
  commentRight: {
    justifyContent: 'flex-end',
  },
  commentBubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.xs,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.lg,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleOwn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  roleOther: {
    backgroundColor: colors.borderLight,
  },
  roleOwnText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleOtherText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  commentMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 10,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textPrimary: {
    color: colors.text.primary,
  },
  timeLight: {
    color: 'rgba(255,255,255,0.6)',
  },
  timeDark: {
    color: colors.text.tertiary,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 14,
    maxHeight: 100,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.text.tertiary,
  },
});
