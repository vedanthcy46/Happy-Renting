import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const ONBOARDING_KEY = 'onboarding_completed';

interface Slide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: readonly [string, string];
  title: string;
  subtitle: string;
  features?: string[];
}

const slides: Slide[] = [
  {
    id: '1',
    icon: 'home',
    gradientColors: ['#2563EB', '#1D4ED8'],
    title: 'Manage Properties',
    subtitle: 'Track tenants, rent and payments all in one beautiful dashboard.',
    features: ['View current bill', 'Track due dates', 'Payment history'],
  },
  {
    id: '2',
    icon: 'card',
    gradientColors: ['#7C3AED', '#6D28D9'],
    title: 'Secure Payments',
    subtitle: 'Collect rent digitally with UPI, cards, and net banking — instantly.',
    features: ['UPI payments', 'Digital receipts', 'Instant notifications'],
  },
  {
    id: '3',
    icon: 'analytics',
    gradientColors: ['#059669', '#047857'],
    title: 'Everything in One Place',
    subtitle: 'Maintenance requests, receipts, analytics and smart notifications — all here.',
    features: ['Raise complaints', 'Download receipts', 'Expense analytics'],
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      await handleComplete();
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await handleComplete();
  };

  const handleComplete = async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      {/* Illustration Card */}
      <LinearGradient
        colors={item.gradientColors}
        style={styles.illustrationCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Decorative circles */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        {/* Main icon */}
        <View style={styles.iconWrapper}>
          <Ionicons name={item.icon} size={72} color="rgba(255,255,255,0.95)" />
        </View>

        {/* Feature chips */}
        <View style={styles.chipRow}>
          {item.features?.map((f, i) => (
            <View key={i} style={styles.chip}>
              <Ionicons name="checkmark-circle" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.chipText}>{f}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Text content */}
      <View style={styles.textContent}>
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          {item.title}
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          {item.subtitle}
        </Text>
      </View>
    </View>
  );

  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: themeColors.text.secondary }]}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Logo at top */}
      <View style={[styles.logoRow, { paddingTop: insets.top + 16 }]}>
        <Image
          source={require('../../assets/images/main-app-icon.png')}
          style={styles.topLogo}
          resizeMode="contain"
        />
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      />

      {/* Bottom area */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === currentIndex ? 28 : 8,
                  backgroundColor: i === currentIndex
                    ? themeColors.primary
                    : themeColors.border,
                },
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        {isLast ? (
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            style={styles.getStartedBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <TouchableOpacity
              style={styles.getStartedInner}
              onPress={handleComplete}
              activeOpacity={0.85}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const CARD_HEIGHT = height * 0.46;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  logoRow: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  topLogo: {
    width: 44,
    height: 44,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  illustrationCard: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -40,
    left: -40,
  },
  iconWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 4,
  },
  chipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomArea: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    gap: 8,
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  getStartedBtn: {
    width: '100%',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  getStartedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
