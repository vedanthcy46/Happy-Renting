import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Image,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 64;

export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  target?: { left: number; top: number; width: number; height: number };
}

interface FeatureWalkthroughProps {
  visible: boolean;
  steps: WalkthroughStep[];
  onFinish: () => void;
  style?: StyleProp<ViewStyle>;
}

const DIM_COLOR = 'rgba(15, 23, 42, 0.82)';
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);
const CARD_TOP = SCREEN_HEIGHT * 0.2;

type ScreenKind = 'intro' | 'feature' | 'done';

export const FeatureWalkthrough: React.FC<FeatureWalkthroughProps> = ({
  visible,
  steps,
  onFinish,
  style,
}) => {
  const { colors: themeColors } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  const introStep: WalkthroughStep = {
    id: '__intro',
    title: 'Welcome to Happy Renting',
    description:
      "Let's take a quick tour so you can make the most of the app — paying rent, tracking bills and raising requests in seconds.",
    icon: 'sparkles',
  };
  const doneStep: WalkthroughStep = {
    id: '__done',
    title: "You're all set!",
    description:
      'You now know your way around. Explore the app at your own pace — your owner is just a tap away if you need help.',
    icon: 'checkmark-circle',
  };

  const allSteps: WalkthroughStep[] = [introStep, ...steps, doneStep];
  const totalSteps = allSteps.length;

  const step = allSteps[Math.min(stepIndex, totalSteps - 1)];
  const kind: ScreenKind =
    stepIndex === 0 ? 'intro' : stepIndex === totalSteps - 1 ? 'done' : 'feature';
  const hasTarget = kind === 'feature' && !!step.target;
  const target = step.target;

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setStepIndex(0);
      opacity.setValue(0);
      translateY.setValue(24);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || stepIndex === 0) return;
    opacity.setValue(0);
    translateY.setValue(24);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, stepIndex]);

  if (!visible) return null;

  const handleNext = () => {
    if (stepIndex >= totalSteps - 1) {
      onFinish();
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  const renderDim = () => {
    if (!hasTarget || !target) return <View style={styles.fullDim} />;
    const t = target;
    return (
      <>
        <View style={[styles.dimRect, { top: 0, left: 0, width: SCREEN_WIDTH, height: t.top }]} />
        <View style={[styles.dimRect, { top: t.top, left: 0, width: t.left, height: t.height }]} />
        <View
          style={[
            styles.dimRect,
            {
              top: t.top,
              left: t.left + t.width,
              width: SCREEN_WIDTH - (t.left + t.width),
              height: t.height,
            },
          ]}
        />
        <View
          style={[
            styles.dimRect,
            {
              top: t.top + t.height,
              left: 0,
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT - (t.top + t.height),
            },
          ]}
        />
        <View style={[styles.highlightBox, { ...t }]} pointerEvents="none">
          <Ionicons name="sparkles" size={18} color="#FFFFFF" style={styles.highlightSparkle} />
        </View>
      </>
    );
  };

  const isFirst = stepIndex === 0;

  return (
    <View style={[styles.container, style]} pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity, transform: [{ translateY }] }]}>
        {renderDim()}

        {/* Skip button (top-right) */}
        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={[styles.skipBtn, { top: Platform.OS === 'ios' ? 58 : 40 }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.skipText, { color: '#FFFFFF' }]}>Skip</Text>
        </TouchableOpacity>

        {/* Content card */}
        <View style={[styles.card, { width: CARD_WIDTH, left: (SCREEN_WIDTH - CARD_WIDTH) / 2, top: CARD_TOP }]}>
          {/* Icon */}
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            {isFirst || kind === 'done' ? (
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.appIcon}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name={step.icon || 'navigate'} size={40} color="#FFFFFF" />
            )}
          </LinearGradient>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.desc}>{step.description}</Text>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {allSteps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === stepIndex ? themeColors.primary : themeColors.border,
                    width: i === stepIndex ? 22 : 7,
                    height: i === stepIndex ? 7 : 7,
                  },
                ]}
              />
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            {!isFirst && (
              <TouchableOpacity
                onPress={() => setStepIndex(Math.max(0, stepIndex - 1))}
                activeOpacity={0.7}
                style={styles.backBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={20} color="#475569" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.85}
              style={[styles.nextBtn, { backgroundColor: themeColors.primary }]}
            >
              <Text style={styles.nextBtnText}>
                {isFirst ? 'Start Tour' : kind === 'done' ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons
                name={isFirst || kind === 'done' ? 'arrow-forward' : 'arrow-forward'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 30,
  },
  fullDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DIM_COLOR,
  },
  dimRect: {
    position: 'absolute',
    backgroundColor: DIM_COLOR,
  },
  highlightBox: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  highlightSparkle: {
    position: 'absolute',
    top: -22,
    right: -8,
  },
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
  },
  card: {
    position: 'absolute',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  appIcon: {
    width: 52,
    height: 52,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
    color: '#0F172A',
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 18,
    color: '#475569',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 20,
  },
  dot: {
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
