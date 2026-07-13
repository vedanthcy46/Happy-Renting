import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { formatRelativeTime } from '../utils';

interface ActivityCardProps {
  title: string;
  description?: string;
  amount?: string;
  type: 'payment' | 'complaint' | 'bill' | 'notification' | 'system';
  timestamp: string;
  status?: string;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  title,
  description,
  amount,
  type,
  timestamp,
  status,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const config: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    payment: { icon: 'card', color: colors.success },
    complaint: { icon: 'chatbubble-ellipses', color: colors.warning },
    bill: { icon: 'document-text', color: colors.primary },
    notification: { icon: 'notifications', color: colors.info },
    system: { icon: 'settings', color: colors.text.secondary },
  };
  const { icon, color } = config[type] || config.system;

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {amount && <Text style={styles.amount}>{amount}</Text>}
        </View>
        {description && <Text style={styles.description} numberOfLines={2}>{description}</Text>}
        <View style={styles.bottomRow}>
          <Text style={styles.timestamp}>{formatRelativeTime(timestamp)}</Text>
          {status && (
            <View style={[styles.statusDot, { backgroundColor: color }]} />
          )}
        </View>
      </View>
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    ...typography.subtitle,
    color: colors.text.primary,
    fontSize: 14,
    flex: 1,
  },
  amount: {
    ...typography.subtitle,
    color: colors.text.primary,
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  description: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timestamp: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 11,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
