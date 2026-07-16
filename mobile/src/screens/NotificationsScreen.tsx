import React from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Text, View, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, Notification } from '../api/notifications';
import { AppCard, EmptyState, ErrorState } from '../components';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { formatRelativeTime } from '../utils';

interface NotificationsScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string, params?: any) => void;
}

const notificationIcons: Record<string, { name: keyof typeof Ionicons.glyphMap; colorKey: string }> = {
  payment_verified: { name: 'checkmark-circle', colorKey: 'success' },
  payment_rejected: { name: 'close-circle', colorKey: 'error' },
  bill_generated: { name: 'document-text', colorKey: 'primary' },
  overdue_reminder: { name: 'alert-circle', colorKey: 'warning' },
  rent_due: { name: 'calendar', colorKey: 'warning' },
  complaint_update: { name: 'clipboard', colorKey: 'info' },
  complaint_resolved: { name: 'checkmark-done', colorKey: 'success' },
  complaint_raised: { name: 'megaphone', colorKey: 'warning' },
  complaint_comment: { name: 'chatbubble', colorKey: 'info' },
  move_out: { name: 'exit', colorKey: 'warning' },
  tenant_move_out: { name: 'exit', colorKey: 'warning' },
  settlement: { name: 'cash', colorKey: 'primary' },
  system: { name: 'settings', colorKey: 'text' },
  deletion_requested: { name: 'trash', colorKey: 'warning' },
  deletion_approved: { name: 'checkmark-circle', colorKey: 'warning' },
  deletion_rejected: { name: 'close-circle', colorKey: 'error' },
  deletion_completed: { name: 'trash-bin', colorKey: 'error' },
  payment_proof_uploaded: { name: 'cloud-upload', colorKey: 'primary' },
  login_alert: { name: 'log-in', colorKey: 'info' },
  new_tenant: { name: 'person-add', colorKey: 'success' },
  rent_reminder: { name: 'calendar', colorKey: 'warning' },
  rent_overdue: { name: 'alert-circle', colorKey: 'error' },
};

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack, onNavigate }) => {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(1, 50),
  });

  const mutationMarkRead = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const mutationMarkAllRead = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const mutationDelete = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousData = queryClient.getQueryData(['notifications']);
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: (old.notifications || []).filter((n: any) => n._id !== deletedId),
        };
      });
      return { previousData };
    },
    onError: (err, newTodo, context: any) => {
      queryClient.setQueryData(['notifications'], context.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const mutationClearAll = useMutation({
    mutationFn: () => clearAllNotifications(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      mutationMarkRead.mutate(notification._id);
    }
    const rentRecordId = notification.data?.rentRecordId;
    switch (notification.type) {
      case 'bill_generated':
      case 'payment_verified':
      case 'payment_rejected':
      case 'overdue_reminder':
      case 'rent_reminder':
      case 'rent_overdue':
        if (rentRecordId) {
          onNavigate?.('rentDetail', { rentRecordId });
        }
        break;
      case 'complaint_update':
      case 'complaint_raised':
      case 'complaint_resolved':
      case 'complaint_comment':
        onNavigate?.('complaints');
        break;
      default:
        break;
    }
  };

  const getIconConfig = (type: string) => {
    const mapping = notificationIcons[type];
    if (mapping) {
      const colorKey = mapping.colorKey as keyof typeof colors;
      return { name: mapping.name, color: colorKey === 'text' ? colors.text.tertiary : (colors[colorKey] as string) };
    }
    return { name: 'notifications-outline' as const, color: colors.text.tertiary };
  };

  const renderRightActions = (id: string, styles: any) => {
    return (
      <TouchableOpacity 
        style={styles.swipeDeleteAction}
        onPress={() => mutationDelete.mutate(id)}
      >
        <Ionicons name="trash-outline" size={24} color="#FFF" />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const iconConfig = getIconConfig(item.type);
    const styles = createStyles(colors);
    return (
      <Swipeable 
        renderRightActions={() => renderRightActions(item._id, styles)}
        containerStyle={{ marginBottom: spacing.sm }}
        onSwipeableRightOpen={() => {
          mutationDelete.mutate(item._id);
        }}
      >
        <TouchableOpacity onPress={() => handleNotificationPress(item)} activeOpacity={0.7}>
          <AppCard
            style={[!item.read && styles.unreadCard] as any}
            variant={item.read ? 'bordered' : 'elevated'}
            padding={spacing.lg}
            animate={false}
          >
            <View style={styles.notifRow}>
              <View style={[styles.notifIcon, { backgroundColor: iconConfig.color + '18' }]}>
                <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.titleRow}>
                  <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.notifBody} numberOfLines={2}>{item.body || item.message}</Text>
                <Text style={styles.notifDate}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          </AppCard>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md, backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text.primary }]}>Notifications</Text>
        <View style={styles.headerActions}>
          {data?.notifications?.length > 0 && (
            <TouchableOpacity onPress={() => mutationClearAll.mutate()} activeOpacity={0.7} style={styles.headerIconBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          )}
          {data?.unreadCount > 0 ? (
            <TouchableOpacity onPress={() => mutationMarkAllRead.mutate()} activeOpacity={0.7} style={styles.markAllButton}>
              <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.markAllButton} />
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ErrorState
            message="Could not load notifications. Pull down to try again."
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={data?.notifications || []}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.lg }]}
          refreshing={isFetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            data?.notifications?.length > 0 ? (
              <Text style={styles.swipeHintText}>
                Tip: Swipe left on a notification to delete it
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No Notifications"
              description="You're all caught up!"
            />
          }
        />
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
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
  },
  markAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  swipeHintText: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  notificationCard: {
    marginBottom: spacing.sm,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  swipeDeleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  notifBody: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  notifDate: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginLeft: spacing.sm,
  },
});
