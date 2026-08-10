import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Keyboard,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, useResponsive } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { useKeyboardInset } from '../hooks/useKeyboardInset';

const OVERLAY_COLOR = 'rgba(15, 23, 42, 0.55)';
const MAX_SHEET_WIDTH = 620;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

interface AppBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[];
  initialSnapIndex?: number;
  maxHeightFraction?: number;
}

export const AppBottomSheet: React.FC<AppBottomSheetProps> = ({
  visible,
  onClose,
  children,
  snapPoints = [0.42, 0.62, 0.86],
  initialSnapIndex = 1,
  maxHeightFraction = 0.92,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useResponsive();
  const keyboardHeight = useKeyboardInset();
  const sheetHeight = useSharedValue(0);
  const gestureStartHeight = useSharedValue(0);

  const MIN_HEIGHT = Math.max(height * 0.28, 120);
  const MAX_HEIGHT = Math.max(height * maxHeightFraction, MIN_HEIGHT);
  const snapHeights = useMemo(
    () => snapPoints.map((f) => clamp(height * f, MIN_HEIGHT, MAX_HEIGHT)),
    [height, snapPoints, MIN_HEIGHT, MAX_HEIGHT]
  );
  const defaultHeight = snapHeights[clamp(initialSnapIndex, 0, snapHeights.length - 1)];

  // On tablets & landscape, keep the sheet readable: cap width + center it.
  const isNarrowed = width >= 600;
  const sheetWidth = isNarrowed ? Math.min(width * 0.94, MAX_SHEET_WIDTH) : undefined;
  const sheetRadius = isNarrowed ? radius.xxl + 4 : undefined;

  const closeSheet = useCallback(() => {
    Keyboard.dismiss();
    sheetHeight.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [sheetHeight, onClose]);

  useEffect(() => {
    if (visible) {
      sheetHeight.value = 0;
      sheetHeight.value = withTiming(defaultHeight, { duration: 280, easing: Easing.out(Easing.cubic) });
    }
  }, [visible, defaultHeight, sheetHeight]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      gestureStartHeight.value = sheetHeight.value;
    })
    .onUpdate((e) => {
      const target = gestureStartHeight.value - e.translationY;
      sheetHeight.value = clamp(target, 0, MAX_HEIGHT);
    })
    .onEnd((e) => {
      const draggedDown = e.translationY > 80;
      const current = sheetHeight.value;
      if (draggedDown || current < MIN_HEIGHT * 0.6) {
        runOnJS(closeSheet)();
        return;
      }
      const nearest = snapHeights.reduce((prev, curr) =>
        Math.abs(curr - current) < Math.abs(prev - current) ? curr : prev
      );
      sheetHeight.value = withSpring(nearest, { damping: 20, stiffness: 220 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: sheetHeight.value / defaultHeight,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      <View style={styles.overlay}>
        <Animated.View pointerEvents="none" style={[styles.scrim, { backgroundColor: OVERLAY_COLOR }, scrimStyle]} />
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeSheet}
        />
        <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                sheetStyle,
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.xxl + 4,
                  borderTopRightRadius: radius.xxl + 4,
                },
                ...(isNarrowed
                  ? [{ width: sheetWidth, alignSelf: 'center' as const, borderRadius: sheetRadius }]
                  : []),
              ]}
            >
              <View style={styles.handleArea}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
              </View>
              <ScrollView
                style={styles.body}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.huge + insets.bottom + keyboardHeight + 16, flexGrow: 1 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                automaticallyAdjustKeyboardInsets={true}
              >
                {children}
              </ScrollView>
            </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
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
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
});
