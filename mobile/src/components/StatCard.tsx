import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

interface StatCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
  valueColor?: string;
  style?: ViewStyle;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendValue,
  color: propColor,
  valueColor,
  style,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const color = propColor || colors.primary;
  const trendColors = {
    up: colors.success,
    down: colors.error,
    neutral: colors.text.secondary,
  };

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
      )}
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {trend && trendValue && (
        <View style={styles.trendRow}>
          <Ionicons
            name={trend === 'up' ? 'arrow-up' : trend === 'down' ? 'arrow-down' : 'remove'}
            size={12}
            color={trendColors[trend]}
          />
          <Text style={[styles.trendText, { color: trendColors[trend] }]}>{trendValue}</Text>
        </View>
      )}
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    minWidth: 100,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 2,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  trendText: {
    ...typography.caption,
    marginLeft: 2,
  },
});
