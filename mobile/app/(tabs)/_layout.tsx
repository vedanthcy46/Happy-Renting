import { Tabs, Redirect } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { colors, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useState, useRef as useReactRef, useEffect } from 'react';
import { AppDrawer } from '../../src/components/AppDrawer';
import { appEvents, OPEN_DRAWER_EVENT } from '../../src/utils/events';

export default function TabLayout() {
  const { token, isLoading } = useAuthStore();
  const { colors: themeColors } = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const translateX = useReactRef(new Animated.Value(-400)).current;
  const overlayOpacity = useReactRef(new Animated.Value(0)).current;

  useEffect(() => {
    const handleOpenDrawer = () => {
      openDrawer();
    };
    appEvents.on(OPEN_DRAWER_EVENT, handleOpenDrawer);
    return () => {
      appEvents.off(OPEN_DRAWER_EVENT, handleOpenDrawer);
    };
  }, []);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: -400,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setDrawerOpen(false));
  };

  if (isLoading) return null;
  if (!token) return <Redirect href="/login" />;

  const headerLeft = () => (
    <TouchableOpacity
      onPress={openDrawer}
      style={{ marginLeft: 16, padding: 4 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="menu" size={26} color={themeColors.text.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: themeColors.surface,
            borderTopWidth: 0,
            elevation: 0,
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            ...Platform.select({
              ios: {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
              },
              android: {
                elevation: 12,
              },
            }),
          },
          tabBarActiveTintColor: themeColors.primary,
          tabBarInactiveTintColor: themeColors.tabInactive,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="rent"
          options={{
            title: 'Payments',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'card' : 'card-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="complaints"
          options={{
            title: 'Requests',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'construct' : 'construct-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
      </Tabs>

      <AppDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        translateX={translateX}
        overlayOpacity={overlayOpacity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabItem: {
    paddingVertical: 4,
  },
});
