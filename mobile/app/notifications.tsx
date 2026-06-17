import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ActivityIndicator, FlatList } from 'react-native';
import { Text } from '@/components/Themed';
import { getNotifications, markAsRead, markAllAsRead, Notification } from '../src/api/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(1, 50),
  });

  const mutationMarkRead = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const mutationMarkAllRead = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.isRead) {
      mutationMarkRead.mutate(notification._id);
    }
    // Optional routing logic based on notification.type
    // if (notification.type === 'bill_generated') {
    //   router.push('/(tabs)/two');
    // }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {item.type === 'payment_verified' && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
        {item.type === 'payment_rejected' && <Ionicons name="close-circle" size={24} color="#F44336" />}
        {item.type === 'bill_generated' && <Ionicons name="document-text" size={24} color="#2196F3" />}
        {!['payment_verified', 'payment_rejected', 'bill_generated'].includes(item.type) && <Ionicons name="notifications" size={24} color="#757575" />}
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.title, !item.isRead && styles.unreadText]}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {data?.unreadCount ? (
          <TouchableOpacity onPress={() => mutationMarkAllRead.mutate()}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={data?.notifications || []}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>You have no notifications</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  markAllText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  listContent: {
    padding: 15,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#F0F8FF',
  },
  iconContainer: {
    marginRight: 15,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#000',
  },
  body: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  date: {
    fontSize: 11,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
    marginLeft: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
  }
});
