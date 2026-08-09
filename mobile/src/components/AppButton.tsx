import React, { useCallback, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
  View,
} from 'react-native';
import { typography, spacing, radius, shadows, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type AppButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const { colors: themeColors } = useTheme();
  const r = useResponsive();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const sizeContainerStyles: Record<AppButtonSize, ViewStyle> = {
    sm: { paddingVertical: r.h(10), paddingHorizontal: r.h(16) },
    md: { paddingVertical: r.h(14), paddingHorizontal: r.h(20) },
    lg: { paddingVertical: r.h(16), paddingHorizontal: r.h(24) },
  };
  const sizeLabelStyles: Record<AppButtonSize, TextStyle> = {
    sm: { fontSize: r.f(14) },
    md: { fontSize: r.f(16) },
    lg: { fontSize: r.f(18) },
  };

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const isDisabled = disabled || loading;

  const themeContainerOverrides: Record<AppButtonVariant, ViewStyle> = {
    primary: { backgroundColor: themeColors.primary },
    secondary: { backgroundColor: themeColors.secondary },
    outline: { 
      backgroundColor: 'transparent', 
      borderWidth: 1, 
      borderColor: themeColors.border,
      elevation: 0,
      shadowOpacity: 0
    },
    ghost: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
    danger: { backgroundColor: themeColors.error },
  };

  const themeLabelOverrides: Record<AppButtonVariant, TextStyle> = {
    primary: { color: themeColors.text.inverse },
    secondary: { color: themeColors.text.inverse },
    outline: { color: themeColors.text.primary },
    ghost: { color: themeColors.primary },
    danger: { color: themeColors.text.inverse },
  };

  const containerStyle: ViewStyle[] = [
    styles.base,
    themeContainerOverrides[variant],
    sizeContainerStyles[size],
    ...(fullWidth ? [styles.fullWidth] : []),
    ...(isDisabled ? [styles.disabled] : []),
    ...(style ? [style as ViewStyle] : []),
  ];

  const labelStyle: TextStyle[] = [
    styles.label,
    themeLabelOverrides[variant],
    sizeLabelStyles[size],
    ...(isDisabled ? [styles.labelDisabled] : []),
    ...(textStyle ? [textStyle as TextStyle] : []),
  ];

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={containerStyle}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : themeColors.primary}
            size="small"
          />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.iconWrapper}>{icon}</View>}
            <Text style={labelStyle}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: spacing.sm,
  },
  // Labels
  label: {
    ...typography.button,
  },
  labelDisabled: {
    opacity: 0.8,
  },
});
