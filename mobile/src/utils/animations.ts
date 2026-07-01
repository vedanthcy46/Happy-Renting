import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

export const useFadeIn = (duration = 400) => {
  const opacity = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [duration]);

  return { opacity, animate };
};

export const useSlideIn = (direction: 'up' | 'down' | 'left' | 'right' = 'up', distance = 20, duration = 400) => {
  const translateMap = {
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  };

  const translate = useRef(new Animated.ValueXY(translateMap[direction])).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(translate, {
        toValue: { x: 0, y: 0 },
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [duration]);

  return {
    opacity,
    translate,
    animatedStyle: {
      opacity,
      transform: [{ translateX: translate.x }, { translateY: translate.y }],
    },
    animate,
  };
};

export const useScaleIn = (initialScale = 0.95, duration = 300) => {
  const scale = useRef(new Animated.Value(initialScale)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [duration]);

  return {
    scale,
    opacity,
    animatedStyle: {
      opacity,
      transform: [{ scale }],
    },
    animate,
  };
};

export const pressAnimation = (anim: Animated.Value) => ({
  pressIn: Animated.spring(anim, {
    toValue: 0.97,
    useNativeDriver: true,
    speed: 50,
    bounciness: 4,
  }),
  pressOut: Animated.spring(anim, {
    toValue: 1,
    useNativeDriver: true,
    speed: 50,
    bounciness: 4,
  }),
});
