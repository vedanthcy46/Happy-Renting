import React from 'react';
import {
  Modal,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
  DimensionValue,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
 * - Android: relies on `automaticallyAdjustKeyboardInsets` so the focused
 *   field scrolls above the keyboard (works inside RN `Modal`, unlike
 *   `adjustResize`/`KeyboardAvoidingView`).
 * - iOS: pads the scroll content by the keyboard height via `useKeyboardInset`
 *   so the focused field can be scrolled above the keyboard.
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

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)' }, overlayStyle]}>
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
          <ScrollView
            style={styles.body}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + keyboardHeight + spacing.xxxl },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'android'}
            bounces={false}
          >
            {children}
          </ScrollView>
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