import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isOnline, subscribeToOnline } from '../sync/networkStatus';

export const OfflineBanner: React.FC = () => {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const unsubscribe = subscribeToOnline(setOnline);
    return unsubscribe;
  }, []);

  // Renders only while actually offline — nothing shows when online.
  if (online) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>Offline mode</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});