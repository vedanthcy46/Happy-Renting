import { Tabs, Redirect } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity, Animated, View, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/store/useAuthStore';
import { colors, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useState, useRef as useReactRef, useEffect, useMemo } from 'react';
import { AppDrawer, FeatureWalkthrough, TAB_BAR_HEIGHT } from '../../src/components';
import { WalkthroughStep } from '../../src/components/FeatureWalkthrough';
import { appEvents, OPEN_DRAWER_EVENT } from '../../src/utils/events';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WALKTHROUGH_KEY_PREFIX = 'walkthrough_completed';

const tabTargets = (() => {
  const tabWidth = SCREEN_WIDTH / 4;
  const top = SCREEN_HEIGHT - TAB_BAR_HEIGHT + 6;
  const width = tabWidth - 8;
  const height = TAB_BAR_HEIGHT - 14;
  return [0, 1, 2, 3].map((i) => ({
    left: tabWidth * i + 4,
    top,
    width,
    height,
  }));
})();

export default function TabLayout() {
  const { token, isLoading, user } = useAuthStore();
  const { colors: themeColors } = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const translateX = useReactRef(new Animated.Value(-400)).current;
  const overlayOpacity = useReactRef(new Animated.Value(0)).current;

  const walkthroughSteps = useMemo<WalkthroughStep[]>(
    () => [
      {
        id: 'home',
        title: 'Dashboard',
        description: 'View your current rent bill, due date and payment status right on the home screen.',
        icon: 'home',
        target: tabTargets[0],
      },
      {
        id: 'payments',
        title: 'Payments',
        description: 'Track all rent transactions, view history and make payments easily.',
        icon: 'card',
        target: tabTargets[1],
      },
      {
        id: 'complaints',
        title: 'Requests',
        description: 'Raise and track maintenance requests and complaints with live updates.',
        icon: 'construct',
        target: tabTargets[2],
      },
      {
        id: 'profile',
        title: 'Profile',
        description: 'Manage your account, security settings, privacy and more.',
        icon: 'person',
        target: tabTargets[3],
      },
    ],
    []
  );

  useEffect(() => {
    const checkWalkthrough = async () => {
      if (!user?._id) return;
      try {
        const completed = await SecureStore.getItemAsync(`${WALKTHROUGH_KEY_PREFIX}_${user._id}`);
        if (!completed) {
          setShowWalkthrough(true);
        }
      } catch {}
    };
    checkWalkthrough();
  }, [user?._id]);

  useEffect(() => {
    const handleOpenDrawer = () => {
      openDrawer();
    };
    appEvents.on(OPEN_DRAWER_EVENT, handleOpenDrawer);
    return () => {
      appEvents.off(OPEN_DRAWER_EVENT, handleOpenDrawer);
    };
  }, []);

  const finishWalkthrough = async () => {
    setShowWalkthrough(false);
    if (user?._id) {
      try {
        await SecureStore.setItemAsync(`${WALKTHROUGH_KEY_PREFIX}_${user._id}`, 'true');
      } catch {}
    }
  };

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

      <FeatureWalkthrough
        visible={showWalkthrough}
        steps={walkthroughSteps}
        onFinish={finishWalkthrough}
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
