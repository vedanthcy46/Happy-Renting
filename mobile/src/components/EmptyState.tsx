import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'folder-open-outline',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { colors } = useTheme();
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(colors, r.f, r.h), [colors, r.f, r.h]);
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={r.h(40)} color={colors.text.tertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <AppButton
          title={actionLabel}
          onPress={onAction}
          variant="outline"
          size="sm"
          style={styles.button}
        />
      )}
    </View>
  );
};

const makeStyles = (colors: any, f: (n: number) => number, h: (n: number) => number) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: h(40),
    paddingHorizontal: h(24),
  },
  iconCircle: {
    width: h(80),
    height: h(80),
    borderRadius: h(40),
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: h(20),
  },
  title: {
    ...typography.h4,
    fontSize: f(18),
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: h(8),
  },
  description: {
    ...typography.body,
    fontSize: f(15),
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: h(20),
  },
});
