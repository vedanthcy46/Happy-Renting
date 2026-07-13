import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const { isOffline } = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setShowBackOnline(false);
      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 40, duration: 300, useNativeDriver: false }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]).start();
    } else if (wasOffline && isOffline === false) {
      setShowBackOnline(true);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(heightAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]).start(() => {
          setShowBackOnline(false);
          setWasOffline(false);
        });
      }, 2000);
    }
  }, [isOffline, wasOffline, heightAnim, opacityAnim]);

  if (!wasOffline && !isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { height: heightAnim, opacity: opacityAnim },
        showBackOnline && styles.backOnline,
      ]}
    >
      <Ionicons
        name={showBackOnline ? 'wifi' : 'wifi-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {showBackOnline ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  backOnline: {
    backgroundColor: '#16A34A',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
