import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  Animated,
} from 'react-native';
import { typography, spacing, radius, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  leftIcon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const { colors } = useTheme();
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(colors, r.f, r.h), [colors, r.f, r.h]);
  const [isFocused, setIsFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[
        styles.inputWrapper,
        { borderColor },
        ...(isFocused ? [styles.inputFocused] : []),
        ...(error ? [styles.inputError] : []),
      ]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          style={[
            styles.input,
            ...(leftIcon ? [styles.inputWithIcon] : []),
            ...(style ? [style] : []),
          ]}
          placeholderTextColor={colors.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const makeStyles = (colors: any, f: (n: number) => number, h: (n: number) => number) => StyleSheet.create({
  container: {
    marginBottom: h(16),
    width: '100%',
  },
  label: {
    ...typography.caption,
    fontSize: f(12),
    color: colors.text.secondary,
    marginBottom: h(8),
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  leftIcon: {
    paddingLeft: h(16),
  },
  input: {
    flex: 1,
    paddingHorizontal: h(16),
    paddingVertical: h(16),
    ...typography.body,
    fontSize: f(15),
    color: colors.text.primary,
  },
  inputWithIcon: {
    paddingLeft: h(12),
  },
  errorText: {
    ...typography.bodySmall,
    fontSize: f(13),
    color: colors.error,
    marginTop: h(4),
  },
});
