import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { spacing, radius } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = radius.sm,
  style,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.cardSkeleton}>
      <SkeletonLoader height={24} width="60%" />
      <View style={{ height: spacing.sm }} />
      <SkeletonLoader height={40} width="40%" />
      <View style={{ height: spacing.md }} />
      <SkeletonLoader height={16} width="80%" />
      <View style={{ height: spacing.sm }} />
      <SkeletonLoader height={16} width="50%" />
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  skeleton: {
    backgroundColor: colors.skeleton,
  },
  cardSkeleton: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
});
