import { Tabs, Redirect } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/store/useAuthStore';
import { colors, typography, useResponsive } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useState, useEffect, useMemo } from 'react';
import { FeatureWalkthrough, getTabBarHeight } from '../../src/components';
import { WalkthroughStep } from '../../src/components/FeatureWalkthrough';
import { useTranslation } from 'react-i18next';

const WALKTHROUGH_KEY_PREFIX = 'walkthrough_completed';

export default function TabLayout() {
  const { t } = useTranslation();
  const { token, isLoading, user, activeWorkspace, needsWorkspacePicker } = useAuthStore();
  const { colors: themeColors } = useTheme();
  const { width, height } = useResponsive();
  const insets = useSafeAreaInsets();

  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const tabBarHeight = getTabBarHeight(insets.bottom);

  const tabTargets = useMemo(() => {
    const tabWidth = width / 4;
    const top = height - tabBarHeight + 6;
    const w = tabWidth - 8;
    const h = tabBarHeight - 14;
    return [0, 1, 2, 3].map((i) => ({
      left: tabWidth * i + 4,
      top,
      width: w,
      height: h,
    }));
  }, [width, height, tabBarHeight]);

  const walkthroughSteps = useMemo<WalkthroughStep[]>(
    () => [
      {
        id: 'home',
        title: t('tabs.home'),
        description: t('tabs.homeDesc'),
        icon: 'home',
        target: tabTargets[0],
      },
      {
        id: 'payments',
        title: t('tabs.payments'),
        description: t('tabs.paymentsDesc'),
        icon: 'card',
        target: tabTargets[1],
      },
      {
        id: 'complaints',
        title: t('tabs.requests'),
        description: t('tabs.requestsDesc'),
        icon: 'construct',
        target: tabTargets[2],
      },
      {
        id: 'profile',
        title: t('tabs.profile'),
        description: t('tabs.profileDesc'),
        icon: 'person',
        target: tabTargets[3],
      },
    ],
    [t, tabTargets]
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

  const finishWalkthrough = async () => {
    setShowWalkthrough(false);
    if (user?._id) {
      try {
        await SecureStore.setItemAsync(`${WALKTHROUGH_KEY_PREFIX}_${user._id}`, 'true');
      } catch {}
    }
  };

  if (isLoading) return null;
  if (!token) return <Redirect href="/login" />;
  // Owner workspace users must never land on the tenant portal.
  // Workspace picker takes priority — don't redirect while it's showing.
  if (!needsWorkspacePicker && activeWorkspace === 'owner') return <Redirect href="/(owner-tabs)" />;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: themeColors.surface,
            borderTopWidth: 0,
            elevation: 0,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
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
            title: t('tabs.home'),
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
            title: t('tabs.payments'),
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
            title: t('tabs.requests'),
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
            title: t('tabs.profile'),
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
    marginTop: 4,
    lineHeight: 13,
  },
  tabItem: {
    paddingVertical: 6,
  },
});
