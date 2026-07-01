import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { getMyTenancy, addRoommate, updateRoommate, deleteRoommate } from '../../src/api/tenant';
import { getRentRecords } from '../../src/api/payment';
import { useAuthStore } from '../../src/store/useAuthStore';
import { AppCard, AppButton, AppInput, StatusBadge, EmptyState, ErrorState, CardSkeleton } from '../../src/components';
import { colors, typography, spacing, radius, shadows } from '../../src/theme';
import { formatCurrency, formatDate, getInitials } from '../../src/utils';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [showRoommateModal, setShowRoommateModal] = useState(false);
  const [editingRoommate, setEditingRoommate] = useState<any>(null);
  const [roommateForm, setRoommateForm] = useState({ name: '', phone: '', idProof: '' });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['myTenancy'],
    queryFn: getMyTenancy,
  });

  const { data: rentData, isLoading: isLoadingRent } = useQuery({
    queryKey: ['rentRecords'],
    queryFn: getRentRecords,
  });

  const tenant = data?.tenant;
  const latestRecord = rentData?.rentRecords?.[0];

  const mutationAdd = useMutation({
    mutationFn: (data: any) => addRoommate(tenant!._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenancy'] });
      setShowRoommateModal(false);
      setRoommateForm({ name: '', phone: '', idProof: '' });
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to add roommate'),
  });

  const mutationUpdate = useMutation({
    mutationFn: (data: any) => updateRoommate(tenant!._id, editingRoommate!._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenancy'] });
      setShowRoommateModal(false);
      setEditingRoommate(null);
      setRoommateForm({ name: '', phone: '', idProof: '' });
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to update roommate'),
  });

  const mutationDelete = useMutation({
    mutationFn: (coId: string) => deleteRoommate(tenant!._id, coId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myTenancy'] }),
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to remove roommate'),
  });

  const handleSaveRoommate = () => {
    if (!roommateForm.name || !roommateForm.phone) {
      Alert.alert('Error', 'Name and phone are required');
      return;
    }
    if (editingRoommate) mutationUpdate.mutate(roommateForm);
    else mutationAdd.mutate(roommateForm);
  };

  const confirmDeleteRoommate = (co: any) => {
    Alert.alert('Remove Roommate', `Are you sure you want to remove ${co.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => mutationDelete.mutate(co._id) },
    ]);
  };

  const handleCallOwner = () => {
    if (tenant?.ownerId?.phone) Linking.openURL(`tel:${tenant.ownerId.phone}`);
  };

  const onRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
  }, []);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (isLoading || isLoadingRent) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + spacing.xxl }]}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </View>
    );
  }

  if (isError || !tenant || tenant.status === 'vacated') {
    return (
      <View style={styles.container}>
        <View style={[styles.center, { paddingTop: insets.top + spacing.huge }]}>
          <EmptyState
            icon={tenant?.status === 'vacated' ? 'exit-outline' : 'home-outline'}
            title={tenant?.status === 'vacated' ? 'Tenancy Ended' : 'No Active Tenancy'}
            description={
              isError
                ? 'Failed to load data.'
                : tenant?.status === 'vacated'
                ? `Your stay concluded on ${tenant.exitDate ? formatDate(tenant.exitDate) : 'an unknown date'}.`
                : "You haven't been assigned to a room yet."
            }
            actionLabel="Try Again"
            onAction={onRefresh}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.headerGradient, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerContent, { paddingTop: insets.top + spacing.lg }]}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.userName}>{user?.name || 'Tenant'}</Text>
            </View>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.propertySubtitle}>
            {tenant.propertyId?.name} · Room {tenant.roomId?.roomNumber}
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isLoadingRent}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Current Bill Card */}
        {latestRecord ? (
          <AppCard style={styles.billCard} variant="elevated">
            <View style={styles.billHeader}>
              <View>
                <Text style={styles.billLabel}>Current Month Rent</Text>
                <Text style={styles.billMonth}>{latestRecord.month}</Text>
              </View>
              <StatusBadge status={latestRecord.status} />
            </View>
            <Text style={styles.billAmount}>{formatCurrency(latestRecord.remainingAmount)}</Text>
            <Text style={styles.billDueLabel}>
              {latestRecord.status === 'paid' || latestRecord.status === 'overpaid'
                ? 'All cleared for this month'
                : 'Remaining Balance'}
            </Text>
            {latestRecord.status !== 'paid' && latestRecord.status !== 'overpaid' && (
              <AppButton
                title="Pay Now"
                onPress={() => router.push('/(tabs)/two')}
                size="md"
                fullWidth
                style={styles.payButton}
              />
            )}
          </AppCard>
        ) : (
          <AppCard style={styles.billCard} variant="elevated">
            <View style={styles.billHeader}>
              <Text style={styles.billLabel}>Current Billing Status</Text>
            </View>
            <Text style={styles.noBillText}>No bills generated yet.</Text>
            <Text style={styles.billDueLabel}>Bills are generated on the 5th of each month.</Text>
          </AppCard>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push('/(tabs)/two')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="card" size={24} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Pay Rent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push('/(tabs)/complaints')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="chatbubble-ellipses" size={24} color={colors.warning} />
            </View>
            <Text style={styles.actionLabel}>Raise Complaint</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push('/(tabs)/two')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="receipt" size={24} color={colors.success} />
            </View>
            <Text style={styles.actionLabel}>View Receipts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleCallOwner}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="call" size={24} color={colors.info} />
            </View>
            <Text style={styles.actionLabel}>Contact Owner</Text>
          </TouchableOpacity>
        </View>

        {/* Room Details */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="bed-outline" size={20} color={colors.text.primary} />
            <Text style={styles.cardTitle}>Your Room</Text>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Property</Text>
              <Text style={styles.detailValue}>{tenant.propertyId?.name}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Room No.</Text>
              <Text style={styles.detailValue}>{tenant.roomId?.roomNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Monthly Rent</Text>
              <Text style={styles.detailValue}>{formatCurrency(tenant.roomId?.monthlyRent)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Due Day</Text>
              <Text style={styles.detailValue}>5th of month</Text>
            </View>
          </View>
        </AppCard>

        {/* Roommates */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="people-outline" size={20} color={colors.text.primary} />
            <Text style={styles.cardTitle}>Roommates</Text>
            <TouchableOpacity
              onPress={() => {
                setEditingRoommate(null);
                setRoommateForm({ name: '', phone: '', idProof: '' });
                setShowRoommateModal(true);
              }}
              style={styles.addButton}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {tenant.coOccupants && tenant.coOccupants.length > 0 ? (
            tenant.coOccupants.map((co: any) => (
              <View key={co._id} style={styles.roommateRow}>
                <View style={styles.roommateAvatar}>
                  <Text style={styles.avatarText}>{getInitials(co.name)}</Text>
                </View>
                <View style={styles.roommateInfo}>
                  <Text style={styles.roommateName}>{co.name}</Text>
                  <Text style={styles.roommatePhone}>{co.phone}</Text>
                </View>
                <View style={styles.roommateActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingRoommate(co);
                      setRoommateForm({ name: co.name, phone: co.phone, idProof: co.idProof || '' });
                      setShowRoommateModal(true);
                    }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="pencil" size={16} color={colors.text.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDeleteRoommate(co)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No roommates added yet.</Text>
          )}
        </AppCard>

        {/* Owner Details */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="person-outline" size={20} color={colors.text.primary} />
            <Text style={styles.cardTitle}>Owner</Text>
          </View>
          <View style={styles.ownerRow}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.avatarText}>{getInitials(tenant.ownerId?.name)}</Text>
            </View>
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerName}>{tenant.ownerId?.name}</Text>
              <Text style={styles.ownerPhone}>{tenant.ownerId?.phone}</Text>
            </View>
          </View>
          <AppButton
            title={`Call ${tenant.ownerId?.name?.split(' ')[0]}`}
            onPress={handleCallOwner}
            variant="outline"
            size="md"
            fullWidth
            icon={<Ionicons name="call-outline" size={18} color={colors.primary} />}
          />
        </AppCard>

        {/* Financials */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="wallet-outline" size={20} color={colors.text.primary} />
            <Text style={styles.cardTitle}>Financials</Text>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Security Deposit</Text>
              <Text style={styles.detailValue}>{formatCurrency(tenant.securityDeposit)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Advance Paid</Text>
              <Text style={styles.detailValue}>{formatCurrency(tenant.advancePaid)}</Text>
            </View>
          </View>
        </AppCard>

        {/* Join Date */}
        <View style={styles.footerSection}>
          <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.joinedText}>
            Joined on {formatDate(tenant.joinDate)}
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Roommate Modal */}
      <Modal visible={showRoommateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingRoommate ? 'Edit Roommate' : 'Add Roommate'}
            </Text>
            <AppInput
              label="Name"
              placeholder="Enter name"
              value={roommateForm.name}
              onChangeText={(text) => setRoommateForm({ ...roommateForm, name: text })}
            />
            <AppInput
              label="Phone"
              placeholder="Enter phone number"
              value={roommateForm.phone}
              onChangeText={(text) => setRoommateForm({ ...roommateForm, phone: text })}
              keyboardType="phone-pad"
            />
            <AppInput
              label="ID Proof (Optional)"
              placeholder="Enter ID proof reference"
              value={roommateForm.idProof}
              onChangeText={(text) => setRoommateForm({ ...roommateForm, idProof: text })}
            />
            <View style={styles.modalButtons}>
              <AppButton
                title="Cancel"
                onPress={() => setShowRoommateModal(false)}
                variant="ghost"
                style={styles.modalButtonHalf}
              />
              <AppButton
                title={editingRoommate ? 'Update' : 'Add'}
                onPress={handleSaveRoommate}
                loading={mutationAdd.isPending || mutationUpdate.isPending}
                style={styles.modalButtonHalf}
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
  loadingContainer: {
    paddingHorizontal: spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    backgroundColor: 'transparent',
  },
  greeting: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  propertySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 160,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
  },
  billCard: {
    marginBottom: spacing.xxl,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  billLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  billMonth: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  billAmount: {
    ...typography.number,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  billDueLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  payButton: {
    marginTop: spacing.sm,
  },
  noBillText: {
    ...typography.subtitle,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  actionItem: {
    alignItems: 'center',
    width: '22%',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 11,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  addButton: {
    padding: spacing.xs,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    width: '50%',
    marginBottom: spacing.md,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xxs,
  },
  detailValue: {
    ...typography.subtitle,
    color: colors.text.primary,
    fontSize: 15,
  },
  roommateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  roommateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  roommateInfo: {
    flex: 1,
  },
  roommateName: {
    ...typography.subtitle,
    color: colors.text.primary,
    fontSize: 15,
  },
  roommatePhone: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: 1,
  },
  roommateActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    ...typography.subtitle,
    color: colors.text.primary,
  },
  ownerPhone: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  footerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  joinedText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
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
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xxl,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  modalButtonHalf: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
});
