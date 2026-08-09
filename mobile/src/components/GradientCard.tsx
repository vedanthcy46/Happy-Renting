import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, Platform, ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

interface GradientCardProps {
  children: React.ReactNode;
  gradient?: readonly [ColorValue, ColorValue, ...ColorValue[]];
  style?: ViewStyle;
}

export const GradientCard: React.FC<GradientCardProps> = ({
  children,
  gradient,
  style,
}) => {
  const { colors } = useTheme();
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(colors, r.h), [colors, r.h]);
  const g = gradient || colors.gradient.card;
  return (
    <View style={[styles.shadow, style]}>
      <LinearGradient
        colors={g as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const makeStyles = (colors: any, h: (n: number) => number) => StyleSheet.create({
  shadow: {
    borderRadius: radius.xl,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  card: {
    borderRadius: radius.xl,
    padding: h(20),
    overflow: 'hidden',
  },
});
