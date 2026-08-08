import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerBillingSync } from '../api/payment';
import { cachedRentRecords } from '../repositories';
import { RentRecord } from '../types/payment';
import { RentCard, EmptyState } from '../components';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

interface RentScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

export const RentScreen: React.FC<RentScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rentRecords'],
    queryFn: cachedRentRecords,
  });

  const mutationSync = useMutation({
    mutationFn: triggerBillingSync,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rentRecords'] });
      Alert.alert(t('rent.syncTitle'), t('rent.syncComplete'));
    },
    onError: (error: any) => Alert.alert(t('rent.syncFailedTitle'), error.response?.data?.message || t('rent.syncFailed')),
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderItem = ({ item, index }: { item: RentRecord; index: number }) => (
    <RentCard
      month={item.month}
      totalRent={item.totalRent}
      totalPaid={item.totalPaid}
      remainingAmount={item.remainingAmount}
      advanceBalance={item.advanceBalance}
      status={item.status}
      dueDate={item.dueDate}
      index={index}
      onPress={() => onNavigate('rentDetail', { rentRecordId: item._id })}
      onPayPress={() => onNavigate('rentDetail', { rentRecordId: item._id })}
    />
  );

  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.headerTitle}>{t('rent.titlePayments')}</Text>
          <Text style={styles.headerSubtitle}>{t('rent.subtitle')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const records = data?.rentRecords || [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.headerTitle}>{t('rent.titlePayments')}</Text>
            <Text style={styles.headerSubtitle}>{t('rent.subtitle')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigate('transaction-history')}
            style={{ padding: spacing.xs }}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={26} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlashList
        data={records}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.overpayNote}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.overpayNoteText}>
              {t('rent.overpayNote')}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="card-outline"
              title={t('rent.noPaymentsYet')}
              description={t('rent.noPaymentsDesc')}
              actionLabel={t('rent.syncMyBilling')}
              onAction={() => mutationSync.mutate()}
            />
          </View>
        }
      />
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  emptyContainer: {
    paddingTop: spacing.huge,
  },
  overpayNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  overpayNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.secondary,
  },
});
