import React from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';

export interface KeyboardSafeModalProps {
  visible: boolean;
  onRequestClose?: () => void;
  animationType?: 'none' | 'slide' | 'fade';
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
  statusBarTranslucent?: boolean;
  transparent?: boolean;
  behavior?: 'padding' | 'height' | 'position';
  keyboardVerticalOffset?: number;
  /** Style for the (flex: 1) overlay that backs the keyboard-aware area. */
  overlayStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Reusable, keyboard-aware Modal shell.
 *
 * Every form/card/dialog that opens in a `Modal` should render through this
 * component instead of hand-rolling `<Modal>` + `KeyboardAvoidingView`.
 *
 * Behaviour:
 * - iOS: `KeyboardAvoidingView` with `padding` (iOS modals do not resize).
 * - Android: `KeyboardAvoidingView` with `height` (Android `<Modal>` windows
 *   ignore `adjustResize`, so the KAV must shrink the overlay explicitly).
 *
 * Individual surfaces may override `behavior` when they need something
 * different (e.g. a bottom sheet that keeps itself pinned and scrolls content).
 */
export const KeyboardSafeModal: React.FC<KeyboardSafeModalProps> = ({
  visible,
  onRequestClose,
  animationType = 'slide',
  presentationStyle,
  statusBarTranslucent,
  transparent = true,
  behavior,
  keyboardVerticalOffset = 0,
  overlayStyle,
  children,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      presentationStyle={presentationStyle}
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        style={[styles.flex, overlayStyle]}
        behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height')}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});