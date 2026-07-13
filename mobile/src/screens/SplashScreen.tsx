import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export const SplashScreen: React.FC = () => {
  // Stage 1: Logo
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;

  // Stage 2: App name
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameTranslateY = useRef(new Animated.Value(24)).current;

  // Stage 3: Tagline
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  // Stage 4: Loading dots
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Stage 1: Logo fade in + spring scale
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Stage 2: Name slides up
      Animated.parallel([
        Animated.timing(nameOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(nameTranslateY, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Stage 3: Tagline
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start(() => {
          // Stage 4: Pulsing dots (loop)
          const pulse = (dotAnim: Animated.Value, delay: number) =>
            Animated.loop(
              Animated.sequence([
                Animated.delay(delay),
                Animated.timing(dotAnim, {
                  toValue: 1,
                  duration: 400,
                  useNativeDriver: true,
                }),
                Animated.timing(dotAnim, {
                  toValue: 0.3,
                  duration: 400,
                  useNativeDriver: true,
                }),
              ])
            );

          pulse(dot1Opacity, 0).start();
          pulse(dot2Opacity, 200).start();
          pulse(dot3Opacity, 400).start();
        });
      });
    });
  }, []);

  return (
    <LinearGradient
      colors={['#2563EB', '#1D4ED8', '#1E40AF']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Background decorative circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Center content */}
      <View style={styles.content}>
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/images/main-app-icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* App name */}
        <Animated.Text
          style={[
            styles.appName,
            {
              opacity: nameOpacity,
              transform: [{ translateY: nameTranslateY }],
            },
          ]}
        >
          Happy Renting
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Smart Rental Management
        </Animated.Text>
      </View>

      {/* Bottom dots */}
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
        <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
        <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
      </View>

      {/* Made in India */}
      <Text style={styles.madeIn}>Made with ❤️ in India</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 80,
    left: -60,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    marginBottom: 28,
  },
  logoCard: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoImage: {
    width: 96,
    height: 96,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 120,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  madeIn: {
    position: 'absolute',
    bottom: 52,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
});
