import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
  TextInput,
  Text,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addRoommate, updateRoommate, deleteRoommate } from '../api/tenant';
import { cachedRentRecords, cachedNotificationsUnread, cachedTenancy } from '../repositories';
import { useAuthStore } from '../store/useAuthStore';
import { AppCard, AppButton, AppInput, StatusBadge, StatCard, GradientCard, EmptyState, ErrorState, CardSkeleton, ActivityCard, AppBottomSheet } from '../components';
import { typography, spacing, radius, shadows, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { formatCurrency, formatDate, getInitials, formatMonth } from '../utils';
import { appEvents, OPEN_DRAWER_EVENT } from '../utils/events';
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher';

interface HomeScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const r = useResponsive();
  const styles = React.useMemo(() => makeStyles(colors, r), [colors, r]);

  const [showRoommateModal, setShowRoommateModal] = useState(false);
  const [editingRoommate, setEditingRoommate] = useState<any>(null);
  const [roommateForm, setRoommateForm] = useState({ name: '', phone: '', idProof: '' });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['myTenancy'],
    queryFn: cachedTenancy,
  });

  const { data: rentData, isLoading: isLoadingRent } = useQuery({
    queryKey: ['rentRecords'],
    queryFn: cachedRentRecords,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: cachedNotificationsUnread,
    refetchInterval: 30 * 1000,
  });
  const unreadCount = notifData?.unreadCount || 0;

  const tenant = data?.tenant;
  const records = rentData?.rentRecords || [];
  const latestRecord = records[0];
  const totalPending = records.reduce((sum, r) => sum + (r.status !== 'paid' && r.status !== 'overpaid' ? r.remainingAmount : 0), 0);
  const depositTotal = Number(tenant?.securityDeposit || 0);
  const depositPaid = Number(tenant?.advancePaid || 0);
  const depositFullyPaid = depositTotal > 0 && depositPaid >= depositTotal;
  const isPrivateRoom = (tenant?.roomId as any)?.capacity === 1;
  const coOccupants = (tenant?.coOccupants as any[]) || [];

  const mutationAdd = useMutation({
    mutationFn: (data: any) => addRoommate(tenant!._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenancy'] });
      setShowRoommateModal(false);
      setRoommateForm({ name: '', phone: '', idProof: '' });
    },
    onError: (error: any) => Alert.alert(t('common.error'), error.response?.data?.message || t('home.addRoommateFailed')),
  });

  const mutationUpdate = useMutation({
    mutationFn: (data: any) => updateRoommate(tenant!._id, editingRoommate!._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenancy'] });
      setShowRoommateModal(false);
      setEditingRoommate(null);
      setRoommateForm({ name: '', phone: '', idProof: '' });
    },
    onError: (error: any) => Alert.alert(t('common.error'), error.response?.data?.message || t('home.updateRoommateFailed')),
  });

  const mutationDelete = useMutation({
    mutationFn: (coId: string) => deleteRoommate(tenant!._id, coId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myTenancy'] }),
    onError: (error: any) => Alert.alert(t('common.error'), error.response?.data?.message || t('home.removeRoommateFailed')),
  });

  const handleSaveRoommate = () => {
    if (!roommateForm.name || !roommateForm.phone) {
      Alert.alert(t('common.error'), t('home.namePhoneRequired'));
      return;
    }
    if (editingRoommate) mutationUpdate.mutate(roommateForm);
    else mutationAdd.mutate(roommateForm);
  };

  const confirmDeleteRoommate = (co: any) => {
    Alert.alert(t('home.removeRoommate'), t('home.removeRoommateConfirm', { name: co.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('home.remove'), style: 'destructive', onPress: () => mutationDelete.mutate(co._id) },
    ]);
  };

  const handleCallOwner = () => {
    if (tenant?.ownerId?.phone) Linking.openURL(`tel:${tenant.ownerId.phone}`);
  };

  const onRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
  }, []);

  if (isLoading || isLoadingRent) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={colors.gradient.primary as any} style={[styles.headerSkeleton, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.skeletonHeaderContent}>
            <View style={styles.skeletonHello} />
            <View style={styles.skeletonName} />
          </View>
        </LinearGradient>
        <View style={[styles.loadingContainer, { paddingTop: 20 }]}>
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
        <View style={[styles.centerContainer, { paddingTop: insets.top + spacing.huge }]}>
          <EmptyState
            icon={tenant?.status === 'vacated' ? 'exit-outline' : 'home-outline'}
            title={tenant?.status === 'vacated' ? t('home.tenancyEnded') : t('home.noActiveTenancy')}
            description={
              isError
                ? t('home.failedLoad')
                : tenant?.status === 'vacated'
                ? t('home.stayEnded', { date: tenant.exitDate ? formatDate(tenant.exitDate) : t('home.unknownDate') })
                : t('home.notAssigned')
            }
            actionLabel={t('home.tryAgain')}
            onAction={onRefresh}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.gradient.primary as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={[styles.headerContent, r.isTablet && { width: '100%', maxWidth: r.maxWidth, alignSelf: 'center' }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[styles.iconButton, { marginRight: spacing.sm }]}
              onPress={() => appEvents.emit(OPEN_DRAWER_EVENT)}
              activeOpacity={0.7}
            >
              <Ionicons name="menu-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={[styles.headerTextBlock, { flex: 1, marginHorizontal: spacing.sm }]}>
              <Text style={styles.greeting}>
                {new Date().getHours() < 12 ? t('home.goodMorning') : new Date().getHours() < 17 ? t('home.goodAfternoon') : t('home.goodEvening')}
              </Text>
              <Text style={styles.userName} numberOfLines={1} adjustsFontSizeToFit>{user?.name || t('home.tenantFallback')}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onNavigate('notifications')}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.propertyRow}>
            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.propertyText}>
              {t('home.propertyText', { tenant: tenant.propertyId?.name, room: tenant.roomId?.roomNumber })}
            </Text>
          </View>
          <View style={{ marginTop: spacing.sm, alignItems: 'flex-start' }}>
            <WorkspaceSwitcher variant="chip" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
          r.isTablet && { width: '100%', maxWidth: r.maxWidth, alignSelf: 'center', paddingHorizontal: r.hpad },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isLoadingRent}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {latestRecord ? (
          <GradientCard gradient={['#4B6BED', '#3D56C9'] as const} style={styles.billCard}>
            <View style={styles.billCardContent}>
              <View style={styles.billTopRow}>
                <View>
                  <Text style={styles.billLabel}>{t('home.currentMonth')}</Text>
                  <Text style={styles.billMonth}>{formatMonth(latestRecord.month)}</Text>
                </View>
                <StatusBadge status={latestRecord.status} />
              </View>
              <Text style={styles.billAmount}>
                {latestRecord.status === 'paid' || latestRecord.status === 'overpaid'
                  ? formatCurrency(0)
                  : formatCurrency(latestRecord.remainingAmount)}
              </Text>
              <Text style={styles.billDueText}>
                {latestRecord.status === 'paid' || latestRecord.status === 'overpaid'
                  ? t('home.allCleared')
                  : t('home.due', { date: formatDate(latestRecord.dueDate) })}
              </Text>
              {latestRecord.status !== 'paid' && latestRecord.status !== 'overpaid' && (
                <TouchableOpacity
                  style={styles.payNowButton}
                  onPress={() => onNavigate('rent')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.payNowText}>{t('home.payRent')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#4B6BED" />
                </TouchableOpacity>
              )}
            </View>
          </GradientCard>
        ) : (
          <AppCard style={styles.billCard} variant="elevated">
            <View style={styles.noBillContent}>
              <Ionicons name="document-text-outline" size={32} color={colors.text.tertiary} />
              <Text style={styles.noBillTitle}>{t('home.noBillsYet')}</Text>
              <Text style={styles.noBillDesc}>{t('home.noBillsDesc')}</Text>
            </View>
          </AppCard>
        )}

        <View style={[styles.statsRow, r.isTablet && styles.statsRowTablet]}>
          <StatCard
            label={t('home.pendingAmount')}
            value={formatCurrency(totalPending)}
            icon="card-outline"
            color={colors.primary}
            valueColor={colors.warning}
            style={r.isTablet ? { flex: 1 } : undefined}
          />

          <View style={[styles.advanceCard, r.isTablet && { flex: 1 }]}>
            <View style={styles.advanceCardHeader}>
              <View style={[styles.advanceIconCircle, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="wallet-outline" size={18} color={colors.success} />
              </View>
              <View style={styles.advanceHeaderText}>
                <Text style={styles.advanceLabel}>{t('home.advanceBalance')}</Text>
                <Text style={styles.advanceCaption}>{t('home.securityDeposit')}</Text>
              </View>
              {depositFullyPaid && (
                <View style={[styles.paidTick, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.advanceValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {formatCurrency(depositPaid)}
            </Text>
            <View style={styles.advanceRows}>
              <View style={styles.advanceRow}>
                <Text style={styles.advanceRowLabel}>{t('home.totalDeposit')}</Text>
                <Text style={styles.advanceRowValue}>{formatCurrency(depositTotal)}</Text>
              </View>
              <View style={styles.advanceRow}>
                <Text style={styles.advanceRowLabel}>{t('home.paid')}</Text>
                <Text style={[styles.advanceRowValue, { color: colors.success }]}>{formatCurrency(depositPaid)}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
        <View style={styles.quickActions}>
          {[
            { icon: 'card', label: t('home.payRent'), color: colors.primary, bgColor: colors.primaryLight, screen: 'rent' },
            { icon: 'chatbubble-ellipses', label: t('home.complaint'), color: colors.warning, bgColor: colors.warningLight, screen: 'complaints' },
            { icon: 'receipt', label: t('home.receipts'), color: colors.success, bgColor: colors.successLight, screen: 'rent' },
            { icon: 'call', label: t('home.contactOwner'), color: colors.info, bgColor: colors.infoLight, screen: '', action: handleCallOwner },
          ].map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.actionItem}
              onPress={() => item.action ? item.action() : onNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: item.bgColor }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.actionLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('home.recentActivity')}</Text>
        <AppCard variant="elevated" padding={spacing.md}>
          {records.slice(0, 3).length > 0 ? (
            records.slice(0, 3).map((record, idx) => (
              <ActivityCard
                key={record._id}
                title={t('home.monthRent', { month: formatMonth(record.month) })}
                description={record.status === 'paid' ? t('home.paymentCompleted') : t('home.remaining', { amount: formatCurrency(record.remainingAmount) })}
                amount={formatCurrency(record.totalRent)}
                type="payment"
                timestamp={record.dueDate}
                status={record.status}
              />
            ))
          ) : (
            <View style={styles.noActivity}>
              <Ionicons name="time-outline" size={24} color={colors.text.tertiary} />
              <Text style={styles.noActivityText}>{t('home.recentActivityEmpty')}</Text>
            </View>
          )}
        </AppCard>

        <Text style={styles.sectionTitle}>{t('home.roomDetails')}</Text>
        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="business-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>{t('home.property')}</Text>
              <Text style={styles.detailValue}>{tenant.propertyId?.name}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="home-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>{t('home.room')}</Text>
              <Text style={styles.detailValue}>{tenant.roomId?.roomNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>{t('home.capacity')}</Text>
              <Text style={styles.detailValue}>
                {(tenant.roomId as any)?.capacity != null ? `${(tenant.roomId as any).capacity} ${(tenant.roomId as any).capacity > 1 ? t('home.people') : t('home.person')}` : '—'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>{t('home.monthlyRent')}</Text>
              <Text style={styles.detailValue}>{formatCurrency(tenant.roomId?.monthlyRent)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>{t('home.dueDay')}</Text>
              <Text style={styles.detailValue}>5th</Text>
            </View>
          </View>
        </AppCard>

        <>
          <Text style={styles.sectionTitle}>{t('home.roommates')}</Text>
          <AppCard variant="elevated" style={styles.sectionCard}>
            {coOccupants.length > 0 && coOccupants.map((co: any, idx: number) => (
              <View key={co._id} style={[styles.roommateRow, idx === coOccupants.length - 1 && { borderBottomWidth: 0 }]}>
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
                    style={styles.actionBtn}
                  >
                    <Ionicons name="pencil" size={16} color={colors.text.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDeleteRoommate(co)}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {isPrivateRoom ? (
              <View style={styles.noRoommates}>
                <Ionicons name="lock-closed-outline" size={24} color={colors.text.tertiary} />
                <Text style={styles.noRoommatesText}>{t('home.privateRoom')}</Text>
              </View>
            ) : coOccupants.length === 0 ? (
              <View style={styles.noRoommates}>
                <Ionicons name="people-outline" size={24} color={colors.text.tertiary} />
                <Text style={styles.noRoommatesText}>{t('home.noRoommates')}</Text>
              </View>
            ) : null}

            {!isPrivateRoom && (
              <TouchableOpacity
                style={styles.addRoommateButton}
                onPress={() => {
                  setEditingRoommate(null);
                  setRoommateForm({ name: '', phone: '', idProof: '' });
                  setShowRoommateModal(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addRoommateText}>{t('home.addRoommate')}</Text>
              </TouchableOpacity>
            )}
          </AppCard>
        </>

        <AppCard variant="elevated" style={styles.sectionCard}>
          <View style={styles.ownerSection}>
            <View style={styles.ownerHeader}>
              <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
              <View style={styles.ownerInfoBlock}>
                <Text style={styles.ownerName}>{tenant.ownerId?.name}</Text>
                <Text style={styles.ownerRole}>{t('home.propertyOwner')}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.ownerCallButton} onPress={handleCallOwner} activeOpacity={0.8}>
              <Ionicons name="call-outline" size={18} color="#FFFFFF" />
              <Text style={styles.ownerCallText}>{t('home.callOwner')}</Text>
            </TouchableOpacity>
          </View>
        </AppCard>

        <View style={styles.footerSection}>
          <Ionicons name="calendar-outline" size={12} color={colors.text.tertiary} />
          <Text style={styles.joinedText}>{t('home.joined', { date: formatDate(tenant.joinDate) })}</Text>
        </View>

        <Text style={styles.aiDisclosure}>
          🤖 Powered by AI — Happy Renting&apos;s Copilot may assist with queries. Always confirm payment and tenancy details with your owner.
        </Text>
      </ScrollView>

      <AppBottomSheet
        visible={showRoommateModal}
        onClose={() => setShowRoommateModal(false)}
      >
        <Text style={styles.modalTitle}>
          {editingRoommate ? t('home.editRoommate') : t('home.addRoommate')}
        </Text>
        <AppInput
          label={t('home.name')}
          placeholder={t('home.enterName')}
          value={roommateForm.name}
          onChangeText={(text) => setRoommateForm({ ...roommateForm, name: text })}
        />
        <AppInput
          label={t('home.phone')}
          placeholder={t('home.enterPhone')}
          value={roommateForm.phone}
          onChangeText={(text) => setRoommateForm({ ...roommateForm, phone: text })}
          keyboardType="phone-pad"
        />
        <AppInput
          label={t('home.idProof')}
          placeholder={t('home.enterIdProof')}
          value={roommateForm.idProof}
          onChangeText={(text) => setRoommateForm({ ...roommateForm, idProof: text })}
        />
        <View style={styles.modalButtons}>
          <View style={{ flex: 1 }}>
            <AppButton
              title={t('common.cancel')}
              onPress={() => setShowRoommateModal(false)}
              variant="ghost"
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton
              title={editingRoommate ? t('home.update') : t('common.add')}
              onPress={handleSaveRoommate}
              loading={mutationAdd.isPending || mutationUpdate.isPending}
              fullWidth
            />
          </View>
        </View>
      </AppBottomSheet>
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  headerGradient: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  headerContent: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTextBlock: {
    backgroundColor: 'transparent',
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    backgroundColor: 'transparent',
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'transparent',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#4B6BED',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'transparent',
  },
  propertyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'transparent',
  },
  headerSkeleton: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  skeletonHeaderContent: {
    backgroundColor: 'transparent',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  skeletonHello: {
    width: 80,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  skeletonName: {
    width: 140,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  loadingContainer: {
    paddingHorizontal: spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  billCard: {
    marginBottom: spacing.lg,
  },
  billCardContent: {
    backgroundColor: 'transparent',
  },
  billTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    backgroundColor: 'transparent',
  },
  billLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  billMonth: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
  },
  billAmount: {
    fontSize: 38,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: spacing.xs,
    backgroundColor: 'transparent',
  },
  billDueText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.lg,
    backgroundColor: 'transparent',
  },
  payNowButton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  payNowText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  noBillContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  noBillTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  noBillDesc: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'column',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  statCardHalf: {
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: spacing.xl,
  },
  advanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  advanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  advanceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  advanceHeaderText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  advanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  advanceCaption: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  advanceValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.success,
    marginBottom: spacing.md,
  },
  paidTick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceRows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  advanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  advanceRowLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  advanceRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    width: '23%',
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    width: '50%',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
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
    fontWeight: '700',
    color: colors.primary,
  },
  roommateInfo: {
    flex: 1,
  },
  roommateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  roommatePhone: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 1,
  },
  roommateActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    padding: spacing.sm,
  },
  addRoommateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  noRoommates: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  noRoommatesText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  addRoommateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  ownerSection: {
    gap: spacing.lg,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ownerInfoBlock: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  ownerRole: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 1,
  },
  ownerCallButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ownerCallText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  noActivity: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  noActivityText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  footerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  joinedText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  aiDisclosure: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xxl,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  modalBtnHalf: {
    flex: 1,
  },
});
