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
import { getTransactionHistory } from '../api/payment';
import { PaymentTransaction } from '../types/payment';
import { StatusBadge, AppCard, EmptyState } from '../components';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { formatDate, formatCurrency } from '../utils';
import { useRouter } from 'expo-router';

type FilterType = 'all' | 'upi' | 'cash' | 'bank_transfer' | 'other';

type ListItem =
  | { type: 'header'; title: string }
  | { type: 'transaction'; transaction: PaymentTransaction };

const methodIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  upi: 'logo-usd', // or logo-behance or qr-code
  cash: 'cash-outline',
  bank_transfer: 'business-outline',
  cheque: 'document-text-outline',
  other: 'help-circle-outline',
};

const methodLabels: Record<string, string> = {
  upi: 'UPI',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export const TransactionHistoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['transactionHistory'],
    queryFn: getTransactionHistory,
  });

  const handleRefresh = async () => {
    try {
      await refetch();
    } catch {
      Alert.alert('Error', 'Failed to refresh transactions');
    }
  };

  const processedData = useMemo(() => {
    if (!data?.transactions) return [];

    // Filter
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

    // Sort descending by paymentDate
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );

    // Group by Month Year
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

    // Flatten
    const flattened: ListItem[] = [];
    Object.keys(groups).forEach((monthYear) => {
      flattened.push({ type: 'header', title: monthYear });
      groups[monthYear].forEach((tx) => {
        flattened.push({ type: 'transaction', transaction: tx });
      });
    });

    return flattened;
  }, [data, filter]);

  if (isError) {
    Alert.alert('Error', 'Could not load transaction history');
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }

    const tx = item.transaction;
    const methodIcon = methodIcons[tx.paymentMethod] || 'help-circle-outline';
    const methodLabel = methodLabels[tx.paymentMethod] || tx.paymentMethod;

    return (
      <AppCard variant="elevated" style={styles.txCard}>
        <View style={styles.txRow}>
          <View style={styles.iconContainer}>
            <Ionicons name={methodIcon} size={22} color={colors.primary} />
          </View>

          <View style={styles.txDetails}>
            <View style={styles.amountRow}>
              <Text style={styles.txAmount}>{formatCurrency(tx.amount)}</Text>
              <StatusBadge status={tx.status} size="sm" />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{methodLabel}</Text>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.metaText}>{formatDate(tx.paymentDate)}</Text>
            </View>
            {tx.referenceId && (
              <Text style={styles.refText} numberOfLines={1}>Ref: {tx.referenceId}</Text>
            )}
          </View>
        </View>
      </AppCard>
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
      {/* Top Bar Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Transaction History</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips row */}
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
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() => setFilter(chip.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  backButton: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...typography.h4,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  filtersWrapper: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
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
  },
  sectionHeaderContainer: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  txCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
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
    alignItems: 'center',
    marginBottom: 4,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  bullet: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginHorizontal: spacing.xs,
  },
  refText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  emptyBox: {
    marginTop: 60,
  },
});
