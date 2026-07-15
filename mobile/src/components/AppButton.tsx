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
import { typography, spacing, radius, shadows } from '../theme';
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    styles[`size_${size}`],
    ...(fullWidth ? [styles.fullWidth] : []),
    ...(isDisabled ? [styles.disabled] : []),
    ...(style ? [style as ViewStyle] : []),
  ];

  const labelStyle: TextStyle[] = [
    styles.label,
    themeLabelOverrides[variant],
    styles[`labelSize_${size}`],
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
  // Sizes
  size_sm: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  size_md: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  },
  size_lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  // Labels
  label: {
    ...typography.button,
  },
  labelDisabled: {
    opacity: 0.8,
  },
  labelSize_sm: {
    fontSize: 14,
  },
  labelSize_md: {
    fontSize: 16,
  },
  labelSize_lg: {
    fontSize: 18,
  },
});
