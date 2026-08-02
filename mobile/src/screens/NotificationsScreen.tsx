import React from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Text, View, Animated, Alert } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, sendTestPush, Notification } from '../api/notifications';
import { cachedNotifications } from '../repositories';
import { usePushStore } from '../store/usePushStore';
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
    queryFn: cachedNotifications,
  });

  const applyNotificationsUpdate = (mutator: (data: any) => any) => {
    queryClient.setQueryData(['notifications'], (old: any) => (old ? mutator(old) : old));
    queryClient.setQueryData(['notifications', 'unread'], (old: any) => (old ? mutator(old) : old));
  };

  const snapshotNotifications = () => ({
    notifications: queryClient.getQueryData(['notifications']),
    unread: queryClient.getQueryData(['notifications', 'unread']),
  });

  const restoreNotifications = (snapshot: any) => {
    if (snapshot.notifications !== undefined) {
      queryClient.setQueryData(['notifications'], snapshot.notifications);
    }
    if (snapshot.unread !== undefined) {
      queryClient.setQueryData(['notifications', 'unread'], snapshot.unread);
    }
  };

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
  };

  const mutationMarkRead = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshot = snapshotNotifications();
      applyNotificationsUpdate((data) => {
        const wasRead = data.notifications?.find((n: any) => n._id === id)?.read;
        return {
          ...data,
          unreadCount: Math.max(0, (data.unreadCount || 0) - (wasRead ? 0 : 1)),
          notifications: (data.notifications || []).map((n: any) =>
            n._id === id ? { ...n, read: true } : n
          ),
        };
      });
      return { snapshot };
    },
    onError: (_err, _id, context: any) => {
      if (context?.snapshot) restoreNotifications(context.snapshot);
    },
    onSettled: invalidateNotifications,
  });

  const mutationMarkAllRead = useMutation({
    mutationFn: () => markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshot = snapshotNotifications();
      applyNotificationsUpdate((data) => ({
        ...data,
        unreadCount: 0,
        notifications: (data.notifications || []).map((n: any) => ({ ...n, read: true })),
      }));
      return { snapshot };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.snapshot) restoreNotifications(context.snapshot);
    },
    onSettled: invalidateNotifications,
  });

  const mutationDelete = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshot = snapshotNotifications();
      applyNotificationsUpdate((data) => {
        const removed = data.notifications?.find((n: any) => n._id === deletedId);
        return {
          ...data,
          unreadCount: Math.max(0, (data.unreadCount || 0) - (removed?.read ? 0 : 1)),
          count: Math.max(0, (data.count || 0) - 1),
          notifications: (data.notifications || []).filter((n: any) => n._id !== deletedId),
        };
      });
      return { snapshot };
    },
    onError: (_err, _newTodo, context: any) => {
      if (context?.snapshot) restoreNotifications(context.snapshot);
    },
    onSettled: invalidateNotifications,
  });

  const mutationClearAll = useMutation({
    mutationFn: () => clearAllNotifications(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshot = snapshotNotifications();
      applyNotificationsUpdate(() => ({
        success: true,
        count: 0,
        total: 0,
        unreadCount: 0,
        notifications: [],
      }));
      return { snapshot };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.snapshot) restoreNotifications(context.snapshot);
    },
    onSettled: invalidateNotifications,
  });

  const mutationTestPush = useMutation({
    mutationFn: () => sendTestPush(),
    onSuccess: (res: any) => {
      if (res?.validPushTokenCount > 0) {
        Alert.alert(
          'Test Push Sent',
          `Sent to ${res.validPushTokenCount} registered device token(s). Check your phone for the notification.`
        );
      } else if (res?.pushTokenCount > 0) {
        Alert.alert('Invalid Tokens', 'Tokens are saved but not valid Expo push tokens. Reinstall the app to re-register.');
      } else {
        const pushState = usePushStore.getState();
        const localDetail =
          pushState.status === 'registered'
            ? `Token synced to server (${pushState.environment}). Try sending again.`
            : pushState.status === 'permission_denied'
            ? 'Notification permission is denied. Enable notifications for this app in Settings, then reopen.'
            : pushState.status === 'no_device'
            ? 'Running on an emulator/simulator. Push requires a physical device.'
            : pushState.status === 'failed'
            ? `Registration failed: ${pushState.error}`
            : pushState.environment
            ? `Running in ${pushState.environment}. Push requires a dev/standalone build on a physical device (Expo Go does not support push on Android).`
            : 'This app must run on a physical device via a development/standalone build (Expo Go does not support push on Android). Reinstall, open once, then retry.';
        Alert.alert('No Push Tokens', localDetail);
      }
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      const raw = error?.message || 'Unknown error';
      Alert.alert(
        'Test Push Failed',
        `Status: ${status ?? 'network/timeout'}\n${serverMsg || raw}`
      );
    },
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
                <Text style={styles.notifBody} numberOfLines={2}>{item.body || (item as any).message}</Text>
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
          {__DEV__ && (
            <TouchableOpacity
              onPress={() => mutationTestPush.mutate()}
              activeOpacity={0.7}
              style={styles.headerIconBtn}
              disabled={mutationTestPush.isPending}
            >
              <Ionicons name={mutationTestPush.isPending ? 'hourglass-outline' : 'paper-plane-outline'} size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          {(data?.notifications?.length ?? 0) > 0 && (
            <TouchableOpacity onPress={() => mutationClearAll.mutate()} activeOpacity={0.7} style={styles.headerIconBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          )}
          {(data?.unreadCount ?? 0) > 0 ? (
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
            (data?.notifications?.length ?? 0) > 0 ? (
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
