const fs = require('fs');
const path = require('path');

const code = `import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme';
import { getTabBarHeight } from './FeatureWalkthrough';

export const AiLauncher = () => {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const pan = useRef(new Animated.ValueXY()).current;
  const lastOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Start dragging if moved more than 5 pixels
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({ x: lastOffset.current.x, y: lastOffset.current.y });
        pan.setValue({ x: 0, y: 0 });
        isDragging.current = true;
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        // Read the private _value only since it's flattened
        lastOffset.current = { x: (pan.x as any)._value, y: (pan.y as any)._value };
        setTimeout(() => { isDragging.current = false; }, 100);
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        lastOffset.current = { x: (pan.x as any)._value, y: (pan.y as any)._value };
        setTimeout(() => { isDragging.current = false; }, 100);
      }
    })
  ).current;

  if (!user || !token) return null;
  if (pathname === '/ai') return null;
  if (pathname.includes('login') || pathname.includes('onboarding')) return null;

  return (
    <Animated.View
      style={[
        styles.button,
        { backgroundColor: colors.primary, bottom: getTabBarHeight(insets.bottom) + spacing.md },
        { transform: pan.getTranslateTransform() }
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.innerContent}
        onPress={() => {
          if (!isDragging.current) {
            router.push('/ai');
          }
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        <Text style={styles.label}>AI</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.lg,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
`;

fs.writeFileSync(path.join(__dirname, '..', 'mobile', 'src', 'components', 'AiLauncher.tsx'), code);
console.log("Updated AiLauncher to be draggable");
