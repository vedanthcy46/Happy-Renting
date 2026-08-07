import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type StatusType = 'paid' | 'pending' | 'overdue' | 'partial' | 'overpaid' | 'verifying' | 'completed' | 'rejected' | 'reversed' | 'open' | 'in-progress' | 'resolved' | 'closed' | 'failed' | 'sent' | string;

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const fallbackConfig = { bg: '#F3F4F6', text: '#6B7280' };

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  style,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    paid: { bg: colors.successLight, text: colors.success, label: 'Paid' },
    completed: { bg: colors.successLight, text: colors.success, label: 'Completed' },
    verified: { bg: colors.successLight, text: colors.success, label: 'Verified' },
    pending: { bg: colors.warningLight, text: colors.warning, label: 'Pending' },
    overdue: { bg: colors.errorLight, text: colors.error, label: 'Overdue' },
    partial: { bg: colors.warningLight, text: '#D97706', label: 'Partial' },
    overpaid: { bg: colors.infoLight, text: colors.info, label: 'Overpaid' },
    verifying: { bg: colors.warningLight, text: '#D97706', label: 'Verifying' },
    rejected: { bg: colors.errorLight, text: colors.error, label: 'Rejected' },
    reversed: { bg: colors.borderLight, text: colors.text.secondary, label: 'Reversed' },
    open: { bg: colors.infoLight, text: colors.info, label: 'Open' },
    'in-progress': { bg: colors.warningLight, text: '#D97706', label: 'In Progress' },
    resolved: { bg: colors.successLight, text: colors.success, label: 'Resolved' },
    closed: { bg: colors.borderLight, text: colors.text.secondary, label: 'Closed' },
    failed: { bg: colors.errorLight, text: colors.error, label: 'Failed' },
    sent: { bg: colors.successLight, text: colors.success, label: 'Sent' },
  };
  const config = statusConfig[status] || { ...fallbackConfig, label: status };
  const isSm = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bg },
      isSm && styles.badgeSm,
      style,
    ]}>
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text style={[
        styles.label,
        { color: config.text },
        isSm && styles.labelSm,
      ]}>
        {config.label}
      </Text>
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 10,
    lineHeight: 12,
  },
});
