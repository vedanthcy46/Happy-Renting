import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong',
  onRetry,
}) => {
  const { colors } = useTheme();
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(colors, r.f, r.h), [colors, r.f, r.h]);
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={r.h(40)} color={colors.error} />
      </View>
      <Text style={styles.title}>Oops!</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <AppButton
          title="Try Again"
          onPress={onRetry}
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
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: h(20),
  },
  title: {
    ...typography.h3,
    fontSize: f(20),
    color: colors.text.primary,
    marginBottom: h(8),
  },
  message: {
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
