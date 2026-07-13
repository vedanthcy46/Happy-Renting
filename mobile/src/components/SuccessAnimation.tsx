import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

interface SuccessAnimationProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onAnimationEnd?: () => void;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  visible,
  title = 'Success!',
  subtitle,
  onAnimationEnd,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  
  // Confetti particles
  const particles = Array.from({ length: 25 }).map((_, i) => ({
    id: i,
    x: Math.random() * 200 - 100,
    y: Math.random() * -150 - 50,
    size: Math.random() * 8 + 4,
    color: ['#FFC107', '#FF5722', '#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#4CAF50'][Math.floor(Math.random() * 7)],
    delay: Math.random() * 300,
    tx: useSharedValue(0),
    ty: useSharedValue(0),
    tScale: useSharedValue(0),
    rotation: useSharedValue(0),
  }));

  useEffect(() => {
    if (visible) {
      // Trigger main checkmark animation
      scale.value = withSpring(1, { damping: 10, stiffness: 80 });
      opacity.value = withTiming(1, { duration: 300 });
      
      // Fade in text
      textOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));

      // Trigger confetti particles
      particles.forEach(p => {
        p.tx.value = withDelay(p.delay, withSpring(p.x, { damping: 15, stiffness: 60 }));
        p.ty.value = withDelay(p.delay, withTiming(p.y + 300, { duration: 1500 }));
        p.tScale.value = withDelay(
          p.delay,
          withSequence(
            withTiming(1, { duration: 100 }),
            withDelay(1000, withTiming(0, { duration: 400 }))
          )
        );
        p.rotation.value = withDelay(
          p.delay,
          withTiming(Math.random() * 720 - 360, { duration: 1500 })
        );
      });

      // Callback on end
      if (onAnimationEnd) {
        const timer = setTimeout(() => {
          onAnimationEnd();
        }, 2200);
        return () => clearTimeout(timer);
      }
    } else {
      scale.value = 0;
      opacity.value = 0;
      textOpacity.value = 0;
      particles.forEach(p => {
        p.tx.value = 0;
        p.ty.value = 0;
        p.tScale.value = 0;
        p.rotation.value = 0;
      });
    }
  }, [visible]);

  if (!visible) return null;

  const animatedCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.container}>
        {/* Backdrop overlay */}
        <View style={styles.backdrop} />

        {/* Confetti Container */}
        <View style={styles.confettiContainer}>
          {particles.map(p => {
            const particleStyle = useAnimatedStyle(() => ({
              transform: [
                { translateX: p.tx.value },
                { translateY: p.ty.value },
                { scale: p.tScale.value },
                { rotate: `${p.rotation.value}deg` },
              ],
            }));

            return (
              <Animated.View
                key={p.id}
                style={[
                  styles.particle,
                  {
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    borderRadius: p.size / 2,
                  },
                  particleStyle,
                ]}
              />
            );
          })}
        </View>

        {/* Success Circle and Checkmark */}
        <Animated.View style={[styles.successCircle, animatedCircleStyle]}>
          <Ionicons name="checkmark" size={60} color="#FFFFFF" />
        </Animated.View>

        {/* Texts */}
        <Animated.View style={[styles.textWrapper, animatedTextStyle]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  confettiContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
  },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  textWrapper: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
