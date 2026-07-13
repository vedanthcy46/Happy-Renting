import React from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAsRead, markAllAsRead, Notification } from '../api/notifications';
import { AppCard, EmptyState } from '../components';
import { colors, typography, spacing, radius } from '../theme';
import { formatRelativeTime } from '../utils';

interface NotificationsScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string, params?: any) => void;
}

const notificationIcons: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  payment_verified: { name: 'checkmark-circle', color: colors.success },
  payment_rejected: { name: 'close-circle', color: colors.error },
  bill_generated: { name: 'document-text', color: colors.primary },
};

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack, onNavigate }) => {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch } = useQuery({
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

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.isRead) {
      mutationMarkRead.mutate(notification._id);
    }
    const rentRecordId = notification.data?.rentRecordId;
    switch (notification.type) {
      case 'bill_generated':
      case 'payment_verified':
      case 'payment_rejected':
      case 'overdue_reminder':
        if (rentRecordId) {
          onNavigate?.('rentDetail', { rentRecordId });
        }
        break;
      case 'complaint_update':
        onNavigate?.('complaints');
        break;
      default:
        break;
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const iconConfig = notificationIcons[item.type] || { name: 'notifications' as const, color: colors.text.tertiary };
    return (
      <TouchableOpacity onPress={() => handleNotificationPress(item)} activeOpacity={0.7}>
        <AppCard
          style={[styles.notificationCard, !item.isRead && styles.unreadCard] as any}
          variant={item.isRead ? 'bordered' : 'elevated'}
          padding={spacing.lg}
        >
          <View style={styles.notifRow}>
            <View style={[styles.notifIcon, { backgroundColor: iconConfig.color + '15' }]}>
              <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
            </View>
            <View style={styles.notifContent}>
              <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}>
                {item.title}
              </Text>
              <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.notifDate}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
        </AppCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notifications</Text>
        {data?.unreadCount ? (
          <TouchableOpacity onPress={() => mutationMarkAllRead.mutate()} activeOpacity={0.7}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.notifications || []}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
    color: colors.text.primary,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  notificationCard: {
    marginBottom: spacing.sm,
  },
  unreadCard: {
    backgroundColor: '#F0F7FF',
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
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 4,
    marginLeft: spacing.sm,
  },
});
