import { Tabs, Redirect } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getTabBarHeight } from '../../src/components';
import { useTranslation } from 'react-i18next';

export default function PgTabLayout() {
  const { t } = useTranslation();
  const { token, isLoading, user, activeWorkspace, needsWorkspacePicker } = useAuthStore();
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarHeight = getTabBarHeight(insets.bottom);

  if (isLoading) return null;
  if (!token) return <Redirect href="/login" />;
  const userRoles = user?.roles ?? (user?.role ? [user.role] : []);
  const canUsePgWorkspace = userRoles.includes('owner') || userRoles.includes('superadmin');
  if (!canUsePgWorkspace) return <Redirect href="/(tabs)" />;
  // Workspace picker takes priority — don't redirect while it's showing.
  if (!needsWorkspacePicker && activeWorkspace === 'owner') return <Redirect href="/(owner-tabs)" />;
  if (!needsWorkspacePicker && activeWorkspace !== 'pg') return <Redirect href="/(tabs)" />;

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
            title: t('pg.tabs.dashboard'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="rooms"
          options={{
            title: t('pg.tabs.rooms'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? 'bed' : 'bed-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="residents"
          options={{
            title: t('pg.tabs.residents'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="collections"
          options={{
            title: t('pg.tabs.collections'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('pg.tabs.profile'),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
            ),
          }}
        />
      </Tabs>
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