import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  DimensionValue,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme';
import { useKeyboardInset } from '../hooks/useKeyboardInset';

export interface KeyboardSafeBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional header title rendered above the scrollable content. */
  title?: string;
  /** Max height for the sheet. Defaults to 90% of the screen. */
  maxHeight?: DimensionValue;
  transparent?: boolean;
  overlayStyle?: StyleProp<ViewStyle>;
}

/**
 * Reusable bottom sheet that stays pinned to the bottom of the screen while
 * the software keyboard is open — the form scrolls into view instead of the
 * sheet moving.
 *
 * The scroll content bottom padding animates to the soft keyboard height via
 * `useKeyboardInset` (JS `Keyboard` events), so the focused field scrolls above
 * the keyboard and the sheet settles back smoothly when it dismisses. Works
 * identically on iOS and Android inside RN `Modal` windows (which ignore
 * `adjustResize` / `KeyboardAvoidingView`).
 */
export const KeyboardSafeBottomSheet: React.FC<KeyboardSafeBottomSheetProps> = ({
  visible,
  onClose,
  children,
  title,
  maxHeight = '90%',
  transparent = true,
  overlayStyle,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardInset();
  const keyboardPad = useSharedValue(0);

  useEffect(() => {
    keyboardPad.value = withTiming(keyboardHeight, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [keyboardHeight, keyboardPad]);

  const scrollContentStyle = useAnimatedStyle(() => ({
    paddingBottom: insets.bottom + keyboardPad.value + spacing.xxxl,
  }));

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)', paddingBottom: insets.bottom + 64 }, overlayStyle]}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, maxHeight }]}>
          <View style={[styles.handleArea]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          {title ? (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
                {title}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          ) : null}
          <Animated.ScrollView
            style={styles.body}
            contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </Animated.ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
    overflow: 'hidden',
  },
  handleArea: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
});