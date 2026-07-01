import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { colors, spacing, radius, shadows } from '../theme';

interface AppCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: number;
  animate?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  onPress,
  style,
  variant = 'default',
  padding = spacing.lg,
  animate = true,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (animate) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [animate]);

  const containerStyle: ViewStyle[] = [
    styles.base,
    styles[`variant_${variant}`],
    { padding },
    style as ViewStyle,
  ];

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  const Wrapper = animate ? Animated.View : View;
  const wrapperProps = animate ? { style: [containerStyle, animatedStyle] as any } : { style: containerStyle };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Wrapper {...wrapperProps}>{children}</Wrapper>
      </TouchableOpacity>
    );
  }

  return <Wrapper {...wrapperProps}>{children}</Wrapper>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
  },
  variant_default: {
    ...shadows.card,
  },
  variant_elevated: {
    ...shadows.lg,
  },
  variant_bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
