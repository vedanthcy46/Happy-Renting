import { Tabs, Redirect } from 'expo-router';
import { Platform, StyleSheet, View, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/store/useAuthStore';
import { colors, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useState, useEffect, useMemo } from 'react';
import { FeatureWalkthrough, TAB_BAR_HEIGHT } from '../../src/components';
import { WalkthroughStep } from '../../src/components/FeatureWalkthrough';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { token, isLoading, user } = useAuthStore();
  const { colors: themeColors } = useTheme();

  const [showWalkthrough, setShowWalkthrough] = useState(false);

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
    [t]
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
    marginTop: 2,
  },
  tabItem: {
    paddingVertical: 4,
  },
});
