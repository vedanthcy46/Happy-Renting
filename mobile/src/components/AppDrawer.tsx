import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Alert,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/useAuthStore';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

interface DrawerItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  dividerAfter?: boolean;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  translateX: Animated.Value;
  overlayOpacity: Animated.Value;
}

export const AppDrawer: React.FC<DrawerProps> = ({ isOpen, onClose, translateX, overlayOpacity }) => {
  const { colors: themeColors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 300);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await logout();
        },
      },
    ]);
  };

  const drawerItems: DrawerItem[] = [
    { icon: 'home', label: 'Dashboard', route: '/(tabs)' },
    { icon: 'card', label: 'Payments', route: '/(tabs)/rent', dividerAfter: true },
    { icon: 'chatbubble', label: 'Maintenance', route: '/(tabs)/complaints' },
    { icon: 'receipt', label: 'Transaction History', route: '/transaction-history', dividerAfter: true },
    { icon: 'help-circle', label: 'Help Center', route: '/help' },
    { icon: 'information-circle', label: 'About Happy Renting', route: '/about' },
    { icon: 'globe', label: 'Visit Website', onPress: () => { onClose(); Linking.openURL('https://happyrenting.netlify.app'); } },
    { icon: 'star', label: 'Rate the App', onPress: () => { onClose(); Linking.openURL('https://play.google.com/store/apps/details?id=com.happyrenting.app'); } },
    { icon: 'share-social', label: 'Share Happy Renting', onPress: () => { onClose(); /* share */ }, dividerAfter: true },
    { icon: 'shield-checkmark', label: 'Privacy Policy', route: '/privacy-policy' },
    { icon: 'document-text', label: 'Terms of Service', route: '/terms-of-service' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Drawer Panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: themeColors.surface,
            transform: [{ translateX }],
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Header */}
        <LinearGradient
          colors={themeColors.gradient.primary as any}
          style={[styles.drawerHeader, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.drawerLogoRow}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.drawerLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.drawerUserInfo}>
            <View style={styles.drawerAvatar}>
              <Text style={styles.drawerAvatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.drawerUserName} numberOfLines={1}>
                {user?.name || 'User'}
              </Text>
              <Text style={styles.drawerUserEmail} numberOfLines={1}>
                {user?.email || ''}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Menu Items */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8 }}
        >
          {drawerItems.map((item, index) => (
            <React.Fragment key={index}>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => item.onPress ? item.onPress() : item.route && navigate(item.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, { backgroundColor: themeColors.primaryLight + '30' }]}>
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={item.color || themeColors.primary}
                  />
                </View>
                <Text style={[styles.drawerItemLabel, { color: themeColors.text.primary }]}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={themeColors.text.tertiary} />
              </TouchableOpacity>
              {item.dividerAfter && (
                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              )}
            </React.Fragment>
          ))}

          {/* Logout */}
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <TouchableOpacity style={styles.drawerItem} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.drawerItemIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.drawerItemLabel, { color: '#EF4444' }]}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 999,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  drawerLogoRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerLogo: {
    width: 100,
    height: 100,
  },
  drawerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  drawerUserName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  drawerUserEmail: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  drawerItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
});
