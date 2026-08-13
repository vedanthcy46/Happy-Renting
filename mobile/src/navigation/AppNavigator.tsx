import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  Dimensions, 
} from 'react-native';
import { AppHeader, AppButton } from '../components';
import { useTheme } from '../theme/ThemeProvider';

const NAVIGATION_ITEMS = [
  { id: 'home', title: 'Home' },
  { id: 'properties', title: 'Properties' },
  { id: 'tenant', title: 'Tenant' },
  { id: 'payments', title: 'Payments' },
  { id: 'profile', title: 'Profile' },
  { id: 'extra', title: 'Extra' },
];

export const AppNavigator: React.FC = () => {
  const [activeItem, setActiveItem] = useState(NAVIGATION_ITEMS[0]);
  const { colors } = useTheme();
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const navbarHeight = 60;
  const buttonGroupPadding = screenWidth > 400 ? 24 : 16;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbarReserver} />
      <AppHeader title="Rent House" />
      <ScrollView 
        style={styles.navGroup}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {NAVIGATION_ITEMS.map((item) => (
          <AppButton
            key={item.id}
            title={item.title}
            onPress={() => setActiveItem(item)}
            style={{ padding: buttonGroupPadding }}
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
  navbarReserver: {
    height: navbarHeight,
  },
  navGroup: {
    flex: 1,
    paddingHorizontal: 16,
  },
  navContent: {
    paddingVertical: 12,
    gap: 12,
    minHeight: 300,
  },
});