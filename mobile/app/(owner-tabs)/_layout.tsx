import { Tabs, Redirect } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/theme';
import { FeatureWalkthrough, getTabBarHeight } from '../../src/components';
import { WalkthroughStep } from '../../src/components/FeatureWalkthrough';
import { useTranslation } from 'react-i18next';

const WALKTHROUGH_KEY_PREFIX = 'owner_walkthrough_completed';

export default function OwnerTabLayout() {
  const { t } = useTranslation();
  const { token, isLoading, user, activeWorkspace, needsWorkspacePicker } = useAuthStore();
  const { colors: themeColors } = useTheme();
  const { width, height } = useResponsive();
  const insets = useSafeAreaInsets();

  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const tabBarHeight = getTabBarHeight(insets.bottom);

  const tabTargets = useMemo(() => {
    const tabWidth = width / 5;
    const top = height - tabBarHeight + 6;
    const w = tabWidth - 8;
    const h = tabBarHeight - 14;
    return [0, 1, 2, 3, 4].map((i) => ({
      left: tabWidth * i + 4,
      top,
      width: w,
      height: h,
    }));
  }, [width, height, tabBarHeight]);

  const walkthroughSteps = useMemo<WalkthroughStep[]>(
    () => [
      {
        id: 'dashboard',
        title: t('tabs.dashboard'),
        description: t('tabs.dashboardDesc'),
        icon: 'grid',
        target: tabTargets[0],
      },
      {
        id: 'properties',
        title: t('tabs.properties'),
        description: t('tabs.propertiesDesc'),
        icon: 'business',
        target: tabTargets[1],
      },
      {
        id: 'tenants',
        title: t('tabs.tenants'),
        description: t('tabs.tenantsDesc'),
        icon: 'people',
        target: tabTargets[2],
      },
      {
        id: 'payments',
        title: t('tabs.payments'),
        description: t('tabs.paymentsDesc'),
        icon: 'wallet',
        target: tabTargets[3],
      },
      {
        id: 'profile',
        title: t('tabs.profile'),
        description: t('tabs.profileDesc'),
        icon: 'person',
        target: tabTargets[4],
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
  // Defensive: pure superadmin (no owner/tenant role) should not reach mobile owner tabs
  const userRoles = user?.roles ?? (user?.role ? [user.role] : []);
  const canUseOwnerWorkspace = userRoles.includes('owner') || userRoles.includes('superadmin');
  if (!canUseOwnerWorkspace) return <Redirect href="/(tabs)" />;
  // Workspace picker takes priority — don't redirect while it's showing.
  if (!needsWorkspacePicker && activeWorkspace !== 'owner') return <Redirect href="/(tabs)" />;

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
            title: t('tabs.dashboard'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="properties"
          options={{
            title: t('tabs.properties'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'business' : 'business-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="tenants"
          options={{
            title: t('tabs.tenants'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: t('tabs.payments'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'wallet' : 'wallet-outline'}
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
