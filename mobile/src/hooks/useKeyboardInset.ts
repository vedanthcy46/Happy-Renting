import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

/**
 * Centralised keyboard observer.
 *
 * Returns the height of the currently visible software keyboard (0 when
 * hidden/absent). This is the single source of truth for any layout that needs
 * to react to the soft keyboard (padding, insets, scroll offsets) without
 * depending on platform-specific `KeyboardAvoidingView` behaviour.
 *
 * Works identically inside React Native `<Modal>` windows (Expo Go, dev builds,
 * and production) because it relies on JS `Keyboard` events, which fire
 * globally — unlike `adjustResize`, which is ignored by Android `Modal` windows.
 */
export function useKeyboardInset(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const handleHide = () => setKeyboardHeight(0);

    // iOS fires `will` events with animation timing; Android only reliably
    // fires `did`. Registering both keeps updates fast and always resolved.
    const showFirstSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillShow', handleShow)
        : Keyboard.addListener('keyboardDidShow', handleShow);
    const hideFirstSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillHide', handleHide)
        : Keyboard.addListener('keyboardDidHide', handleHide);
    const showFallbackSub = Keyboard.addListener('keyboardDidShow', handleShow);
    const hideFallbackSub = Keyboard.addListener('keyboardDidHide', handleHide);

    return () => {
      showFirstSub.remove();
      hideFirstSub.remove();
      showFallbackSub.remove();
      hideFallbackSub.remove();
    };
  }, []);

  return keyboardHeight;
}