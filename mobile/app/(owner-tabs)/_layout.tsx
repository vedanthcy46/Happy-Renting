import { Tabs, Redirect } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function OwnerTabLayout() {
  const { token, isLoading, user } = useAuthStore();
  const { colors: themeColors } = useTheme();

  if (isLoading) return null;
  if (!token) return <Redirect href="/login" />;
  // Defensive: pure superadmin (no owner/tenant role) should not reach mobile owner tabs
  const userRoles = user?.roles ?? (user?.role ? [user.role] : []);
  const canUseOwnerWorkspace = userRoles.includes('owner') || userRoles.includes('superadmin');
  if (!canUseOwnerWorkspace) return <Redirect href="/(tabs)" />;

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
            title: 'Dashboard',
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
            title: 'Properties',
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
            title: 'Tenants',
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
            title: 'Payments',
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
