import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../store/useAuthStore';
import { colors, typography } from '../theme';

import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { RentScreen } from '../screens/RentScreen';
import { RentDetailScreen } from '../screens/RentDetailScreen';
import { ComplaintScreen } from '../screens/ComplaintScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { Text, View } from 'react-native';

export type RootStackParamList = {
  MainTabs: undefined;
  RentDetail: { rentRecordId: string };
  Notifications: undefined;
};

export type TabParamList = {
  Home: undefined;
  Rent: undefined;
  Complaints: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function HomeWrapper() {
  const navigation = useNavigation<any>();
  return (
    <HomeScreen
      onNavigate={(screen, params) => {
        if (screen === 'notifications') navigation.navigate('Notifications');
        else if (screen === 'rentDetail') navigation.navigate('RentDetail', params);
        else if (screen === 'rent') navigation.navigate('Rent');
        else if (screen === 'complaints') navigation.navigate('Complaints');
      }}
    />
  );
}

function RentWrapper() {
  const navigation = useNavigation<any>();
  return (
    <RentScreen
      onNavigate={(screen, params) => {
        if (screen === 'rentDetail') navigation.navigate('RentDetail', params);
      }}
    />
  );
}

function ProfileWrapper() {
  const { logout } = useAuthStore();
  const navigation = useNavigation<any>();
  return (
    <ProfileScreen
      onLogout={async () => {
        await logout();
      }}
    />
  );
}

function NotificationsWrapper() {
  const navigation = useNavigation<any>();
  return <NotificationsScreen onBack={() => navigation.goBack()} />;
}

function RentDetailWrapper({ route }: any) {
  const navigation = useNavigation<any>();
  return (
    <RentDetailScreen
      rentRecordId={route.params?.rentRecordId}
      onBack={() => navigation.goBack()}
    />
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          ...Platform.select({
            ios: {
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          fontFamily: typography.tab.fontFamily || undefined,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeWrapper}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Rent"
        component={RentWrapper}
        options={{
          tabBarLabel: 'Rent',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'card' : 'card-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Complaints"
        component={ComplaintScreen}
        options={{
          tabBarLabel: 'Complaints',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileWrapper}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const { token, isLoading } = useAuthStore();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {token ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="Notifications"
            component={NotificationsWrapper}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="RentDetail"
            component={RentDetailWrapper}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      ) : (
        <LoginScreen
          onLoginSuccess={() => {
            useAuthStore.getState().initialize();
          }}
        />
      )}
    </NavigationContainer>
  );
};
