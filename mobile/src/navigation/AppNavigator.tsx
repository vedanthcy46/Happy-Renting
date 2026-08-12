import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { AppButton } from '../components/AppButton';

const NAVIGATION_ITEMS = [
  { id: 'home', title: 'Home' },
  { id: 'properties', title: 'Properties' },
  { id: 'tenant', title: 'Tenant' },
  { id: 'payments', title: 'Payments' },
  { id: 'profile', title: 'Profile' },
  { id: 'extra', title: 'Extra' },
];

export const AppNavigator: React.FC = () => {
  const [activeItem, setActiveItem] = useState<typeof NAVIGATION_ITEMS[0]>(NAVIGATION_ITEMS[0]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Navbar */}
      <AppHeader title="Rent House" />

      {/* Navigation Button Group - placed BELOW navbar to avoid overlap */}
      <ScrollView style={styles.navGroup}>
        {NAVIGATION_ITEMS.map((item) => (
          <AppButton
            key={item.id}
            title={item.title}
            onPress={() => setActiveItem(item)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  navGroup: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
});
