import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { typography, spacing, radius, shadows, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, formatMonth } from '../utils';

interface RentCardProps {
  month: string;
  totalRent: number;
  totalPaid: number;
  remainingAmount: number;
  advanceBalance?: number;
  status: string;
  dueDate: string;
  onPress?: () => void;
  onPayPress?: () => void;
  index?: number;
}

export const RentCard: React.FC<RentCardProps> = ({
  month,
  totalRent,
  totalPaid,
  remainingAmount,
  advanceBalance = 0,
  status,
  dueDate,
  onPress,
  onPayPress,
  index = 0,
}) => {
  const { colors } = useTheme();
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(colors, r.f, r.h), [colors, r.f, r.h]);
  const isPaid = status === 'paid' || status === 'overpaid';
  const progress = totalRent > 0 ? totalPaid / totalRent : 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.monthBadge}>
              <Text style={styles.monthText}>{formatMonth(month)}</Text>
            </View>
            <StatusBadge status={status} />
          </View>

          <View style={styles.amountRow}>
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>Rent</Text>
              <Text style={styles.amountValue}>{formatCurrency(totalRent)}</Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>Paid</Text>
              <Text style={[styles.amountValue, { color: colors.success }]}>{formatCurrency(totalPaid)}</Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>Due</Text>
              <Text style={[styles.amountValue, { color: isPaid ? colors.success : colors.error }]}>
                {formatCurrency(remainingAmount)}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: isPaid ? colors.success : colors.primary }]} />
            </View>
          </View>

          {advanceBalance > 0 && (
            <View style={styles.advanceBadge}>
              <Ionicons name="trending-up" size={12} color="#16A34A" />
              <Text style={styles.advanceText}>+{formatCurrency(advanceBalance)} Floating</Text>
            </View>
          )}

          {!isPaid && (
            <TouchableOpacity style={styles.payButton} onPress={onPayPress} activeOpacity={0.8}>
              <Text style={styles.payButtonText}>Pay Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const makeStyles = (colors: any, f: (n: number) => number, h: (n: number) => number) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: h(16),
    marginBottom: h(12),
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(16),
  },
  monthBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: h(12),
    paddingVertical: h(6),
    borderRadius: radius.md,
  },
  monthText: {
    ...typography.buttonSmall,
    fontSize: f(14),
    color: colors.primary,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: h(16),
  },
  amountBlock: {
    alignItems: 'center',
    flex: 1,
  },
  amountDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  amountLabel: {
    ...typography.caption,
    fontSize: f(11),
    color: colors.text.secondary,
    marginBottom: 4,
  },
  amountValue: {
    ...typography.subtitle,
    fontSize: f(16),
    color: colors.text.primary,
  },
  progressContainer: {
    marginBottom: h(16),
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  advanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.full,
    paddingHorizontal: h(10),
    paddingVertical: 2,
    marginBottom: h(16),
  },
  advanceText: {
    fontSize: f(10),
    fontWeight: '700',
    color: '#16A34A',
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: h(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: h(8),
  },
  payButtonText: {
    ...typography.button,
    fontSize: f(16),
    color: '#FFFFFF',
  },
});
