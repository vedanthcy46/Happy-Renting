import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
const TypedFlashList = FlashList as any;
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cachedTransactionHistory } from '../repositories';
import { PaymentTransaction } from '../types/payment';
import { StatusBadge, AppCard, EmptyState } from '../components';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { formatDate, formatCurrency } from '../utils';
import { useRouter } from 'expo-router';

type FilterType = 'all' | 'upi' | 'cash' | 'bank_transfer' | 'other';

type ListItem =
  | { type: 'header'; title: string; total: number }
  | { type: 'transaction'; transaction: PaymentTransaction };

const methodIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  upi: 'qr-code-outline',
  cash: 'cash-outline',
  bank_transfer: 'business-outline',
  cheque: 'document-text-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

const methodLabels: Record<string, string> = {
  upi: 'UPI',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

const methodColors: Record<string, string> = {};

export const TransactionHistoryScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['transactionHistory'],
    queryFn: cachedTransactionHistory,
  });

  const handleRefresh = async () => {
    try {
      await refetch();
    } catch {
      Alert.alert('Error', 'Failed to refresh transactions');
    }
  };

  const summaryTotal = useMemo(() => {
    if (!data?.transactions) return 0;
    return data.transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [data]);

  const processedData = useMemo(() => {
    if (!data?.transactions) return [];

    let filtered = data.transactions;
    if (filter !== 'all') {
      if (filter === 'other') {
        filtered = data.transactions.filter(
          (tx) => tx.paymentMethod === 'other' || tx.paymentMethod === 'cheque'
        );
      } else {
        filtered = data.transactions.filter((tx) => tx.paymentMethod === filter);
      }
    }

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );

    const groups: Record<string, PaymentTransaction[]> = {};
    sorted.forEach((tx) => {
      const date = new Date(tx.paymentDate);
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(tx);
    });

    const flattened: ListItem[] = [];
    Object.keys(groups).forEach((monthYear) => {
      const groupTotal = groups[monthYear].reduce((sum, tx) => sum + tx.amount, 0);
      flattened.push({ type: 'header', title: monthYear, total: groupTotal });
      groups[monthYear].forEach((tx) => {
        flattened.push({ type: 'transaction', transaction: tx });
      });
    });

    return flattened;
  }, [data, filter]);

  const filteredCount = useMemo(() => {
    return processedData.filter((item) => item.type === 'transaction').length;
  }, [processedData]);

  if (isError) {
    Alert.alert('Error', 'Could not load transaction history');
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeaderContainer}>
          <View style={styles.sectionHeaderLine} />
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderText}>{item.title}</Text>
            <Text style={styles.sectionHeaderTotal}>{formatCurrency(item.total)}</Text>
          </View>
        </View>
      );
    }

    const tx = item.transaction;
    const methodIcon = methodIcons[tx.paymentMethod] || 'ellipsis-horizontal-circle-outline';
    const methodLabel = methodLabels[tx.paymentMethod] || tx.paymentMethod;
    const isFailed = tx.status === 'rejected';
    const isPending = tx.status === 'pending' || tx.status === 'verifying';

    return (
      <View style={styles.txCard}>
        <View style={styles.txRow}>
          <View style={[styles.iconContainer, { backgroundColor: isFailed ? colors.errorLight : isPending ? colors.warningLight : colors.successLight }]}>
            <Ionicons name={methodIcon} size={20} color={isFailed ? colors.error : isPending ? colors.warning : colors.success} />
          </View>

          <View style={styles.txDetails}>
            <View style={styles.amountRow}>
              <View style={styles.amountLeft}>
                <Text style={styles.txMethod}>{methodLabel}</Text>
                {tx.referenceId && (
                  <Text style={styles.refText} numberOfLines={1}>Ref: {tx.referenceId}</Text>
                )}
              </View>
              <Text style={[styles.txAmount, isFailed && { color: colors.error }, isPending && { color: colors.warning }]}>
                {formatCurrency(tx.amount)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{formatDate(tx.paymentDate)}</Text>
              <View style={styles.metaDot} />
              <StatusBadge status={tx.status} size="sm" />
            </View>
          </View>
        </View>
      </View>
    );
  };

  const filterChips: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'UPI', value: 'upi' },
    { label: 'Cash', value: 'cash' },
    { label: 'Bank Transfer', value: 'bank_transfer' },
    { label: 'Other', value: 'other' },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Transactions</Text>
          <Text style={styles.topBarSubtitle}>{filteredCount} payment{filteredCount !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {!isLoading && data?.transactions && data.transactions.length > 0 && (
        <View style={[styles.summaryBar, { backgroundColor: colors.primaryLight }]}>
          <Text style={styles.summaryLabel}>Total paid</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summaryTotal)}</Text>
        </View>
      )}

      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {filterChips.map((chip) => {
            const isSelected = filter === chip.value;
            return (
              <TouchableOpacity
                key={chip.value}
                style={[styles.filterChip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setFilter(chip.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && { color: '#FFFFFF' }]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <TypedFlashList
            data={processedData}
            renderItem={renderItem}
            getItemType={(item: ListItem) => item.type}
            estimatedItemSize={80}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <EmptyState
                  icon="receipt-outline"
                  title="No Transactions"
                  description="No payments match your filter query."
                />
              </View>
            }
          />
        </View>
      )}
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  filtersWrapper: {
    paddingVertical: spacing.md,
  },
  filtersScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    paddingTop: spacing.xs,
  },
  sectionHeaderContainer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderLine: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  sectionHeaderTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  txCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  txDetails: {
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  amountLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  txMethod: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.tertiary,
  },
  refText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  emptyBox: {
    marginTop: 60,
  },
});
