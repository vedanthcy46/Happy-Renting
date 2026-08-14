import React, { useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useKeyboardInset } from '../hooks/useKeyboardInset';

export interface KeyboardSafeModalProps {
  visible: boolean;
  onRequestClose?: () => void;
  animationType?: 'none' | 'slide' | 'fade';
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
  statusBarTranslucent?: boolean;
  transparent?: boolean;
  /** Kept for API compatibility. Keyboard avoidance is animated, not KAV-based. */
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
 * - The overlay height is animated with `withTiming` to shrink exactly by the
 *   keyboard height when it opens and to restore when it closes. This avoids
 *   the abrupt (unanimated) height snap of `KeyboardAvoidingView` that makes
 *   bottom sheets "jiggle" up and down.
 * - Works identically inside React Native `<Modal>` windows (Expo Go, dev
 *   builds, production) because it relies on JS `Keyboard` events, which fire
 *   globally — unlike `adjustResize`, which is ignored by Android `Modal`
 *   windows.
 */
export const KeyboardSafeModal: React.FC<KeyboardSafeModalProps> = ({
  visible,
  onRequestClose,
  animationType = 'slide',
  presentationStyle,
  statusBarTranslucent,
  transparent = true,
  keyboardVerticalOffset = 0,
  overlayStyle,
  children,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardInset();
  const containerHeight = useSharedValue(windowHeight);

  useEffect(() => {
    containerHeight.value = withTiming(
      Math.max(windowHeight - keyboardHeight - keyboardVerticalOffset, 0),
      { duration: 220, easing: Easing.out(Easing.cubic) }
    );
  }, [keyboardHeight, windowHeight, keyboardVerticalOffset, containerHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
    flex: 0,
  }));

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      presentationStyle={presentationStyle}
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={onRequestClose}
    >
      <Animated.View style={[styles.flex, overlayStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});