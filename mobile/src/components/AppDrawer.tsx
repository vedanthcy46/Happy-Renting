import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Share,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useResponsive } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkspacePicker } from './WorkspacePicker';
import { PremiumTag } from './PremiumTag';
import { useQuery } from '@tanstack/react-query';
import { cachedOwnerPendingApprovals, cachedOwnerComplaints, cachedNotificationsUnread } from '../repositories';
import { getAiEntitlement } from '../api/ai';

const DRAWER_WIDTH_MAX = 360;

const PREMIUM_PLANS = ['MONTHLY', 'ANNUAL', 'LIFETIME'];

interface DrawerItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  dividerAfter?: boolean;
  /** Optional count badge shown on the right (hidden when 0/undefined). */
  badge?: number;
  /** Renders a small "Premium" tag next to the label for premium-only features. */
  premium?: boolean;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  translateX: Animated.Value;
  overlayOpacity: Animated.Value;
}

export const AppDrawer: React.FC<DrawerProps> = ({ isOpen, onClose, translateX, overlayOpacity }) => {
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();
  const router = useRouter();
  const { user, logout, activeWorkspace, setWorkspace } = useAuthStore();

  const drawerWidth = Math.min(width * 0.82, DRAWER_WIDTH_MAX);

  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const isOwner = roles.includes('owner');
  const isMultiRole = roles.includes('owner') && roles.includes('tenant');
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);

  const isOwnerWorkspace = activeWorkspace === 'owner';
  const isPgWorkspace = activeWorkspace === 'pg';

  // Pending count badges for the owner menu — only fetched while the drawer is open.
  const { data: approvalsData } = useQuery({
    queryKey: ['ownerPendingApprovals'],
    queryFn: cachedOwnerPendingApprovals,
    enabled: isOpen && isOwnerWorkspace,
    staleTime: 30 * 1000,
  });
  const { data: complaintsData } = useQuery({
    queryKey: ['ownerComplaints'],
    queryFn: cachedOwnerComplaints,
    enabled: isOpen && (isOwnerWorkspace || isPgWorkspace),
    staleTime: 30 * 1000,
  });
  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: cachedNotificationsUnread,
    enabled: isOpen && (isOwnerWorkspace || isPgWorkspace),
    refetchInterval: 30 * 1000,
  });

  const { data: planData } = useQuery({
    queryKey: ['planStatus', 'owner'],
    queryFn: () => getAiEntitlement('owner'),
    enabled: isOpen && isOwnerWorkspace,
    staleTime: 60 * 1000,
  });
  const isOwnerPremium = PREMIUM_PLANS.includes(planData?.entitlement?.plan || 'FREE');

  const pendingApprovalsCount = approvalsData?.transactions?.length ?? 0;
  const openComplaintsCount = (complaintsData?.complaints ?? []).filter(
    (c: { status?: string }) => c.status === 'pending' || c.status === 'in-progress'
  ).length;
  const unreadCount = notifData?.unreadCount ?? 0;

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 300);
  };

  const promptUpgrade = () => {
    onClose();
    setTimeout(() => {
      Alert.alert(
        t('subscription.premiumRequiredTitle'),
        t('subscription.reportsPremiumMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('subscription.viewPlans'), onPress: () => router.navigate('/subscription' as any) },
        ]
      );
    }, 300);
  };

  const handleLogout = () => {
    Alert.alert(t('drawer.logoutConfirmTitle'), t('drawer.logoutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('drawer.logoutConfirmTitle'),
        style: 'destructive',
        onPress: async () => {
          onClose();
          await logout();
        },
      },
    ]);
  };

  // ── Tenant-specific nav items ──────────────────────────────────────────
  const tenantItems: DrawerItem[] = [
    { icon: 'home', label: t('tabs.home'), route: '/(tabs)' },
    { icon: 'card', label: t('tabs.payments'), route: '/(tabs)/rent', dividerAfter: true },
    { icon: 'construct', label: t('tabs.requests'), route: '/(tabs)/complaints' },
    { icon: 'receipt', label: t('drawer.transactionHistory'), route: '/transaction-history', dividerAfter: true },
  ];

  // ── Owner-specific nav items ───────────────────────────────────────────
  const ownerItems: DrawerItem[] = [
    { icon: 'grid', label: t('tabs.dashboard'), route: '/(owner-tabs)' },
    { icon: 'business', label: t('tabs.properties'), route: '/(owner-tabs)/properties' },
    { icon: 'people', label: t('tabs.tenants'), route: '/(owner-tabs)/tenants', dividerAfter: true },
    { icon: 'person-add', label: t('drawer.addTenant'), route: '/owner/add-tenant' },
    { icon: 'wallet', label: t('tabs.payments'), route: '/(owner-tabs)/payments' },
    { icon: 'checkmark-done-circle', label: t('drawer.pendingApprovals'), route: '/owner/approvals', badge: pendingApprovalsCount },
    { icon: 'construct', label: t('drawer.complaints'), route: '/owner/complaints', badge: openComplaintsCount },
    { icon: 'trending-up', label: t('drawer.expenses'), route: '/owner/expenses' },
    { icon: 'bar-chart', label: t('drawer.reports'), route: isOwnerPremium ? '/owner/reports' : undefined, onPress: isOwnerPremium ? undefined : promptUpgrade, premium: true, dividerAfter: true },
    { icon: 'notifications', label: t('drawer.notifications'), route: '/notifications', badge: unreadCount, dividerAfter: true },
  ];

  // ── Shared items for all roles ─────────────────────────────────────────
  const sharedItems: DrawerItem[] = [
    { icon: 'settings', label: t('common.settings'), route: '/settings', dividerAfter: true },
    { icon: 'help-circle', label: t('drawer.helpCenter'), route: '/help' },
    { icon: 'information-circle', label: t('drawer.about'), route: '/about' },
    {
      icon: 'globe',
      label: t('drawer.visitWebsite'),
      onPress: () => { onClose(); Linking.openURL('https://happyrenting.netlify.app'); },
    },
    {
      icon: 'star',
      label: t('drawer.rateApp'),
      onPress: () => {
        onClose();
        Linking.openURL('https://play.google.com/store/apps/details?id=co.in.happyrenting.tenant');
      },
    },
    {
      icon: 'share-social',
      label: t('drawer.shareApp'),
      onPress: async () => {
        onClose();
        try {
          await Share.share({
            title: 'Happy Renting',
            message:
              'Manage rent, pay bills, and track your property hassle-free with Happy Renting! Download the app: https://play.google.com/store/apps/details?id=co.in.happyrenting.tenant',
          });
        } catch (err) {
          Alert.alert(t('errors.generic'), t('settings.shareErrorMsg'));
        }
      },
      dividerAfter: true,
    },
    { icon: 'shield-checkmark', label: t('drawer.privacyPolicy'), route: '/privacy-policy' },
    { icon: 'document-text', label: t('drawer.termsOfService'), route: '/terms-of-service' },
  ];

  // ── PG-specific nav items ──────────────────────────────────────────────
  const pgItems: DrawerItem[] = [
    { icon: 'grid', label: t('pg.drawer.dashboard'), route: '/(pg-tabs)' },
    { icon: 'bed', label: t('pg.drawer.roomsBeds'), route: '/(pg-tabs)/rooms', dividerAfter: true },
    { icon: 'people', label: t('pg.drawer.residents'), route: '/(pg-tabs)/residents' },
    { icon: 'person-add', label: t('pg.drawer.addResident'), route: '/owner/add-tenant' },
    { icon: 'wallet', label: t('pg.drawer.collections'), route: '/(pg-tabs)/collections' },
    { icon: 'construct', label: t('pg.drawer.complaints'), route: '/owner/complaints', badge: openComplaintsCount },
    { icon: 'trending-up', label: t('pg.drawer.expenses'), route: '/owner/expenses', dividerAfter: true },
    { icon: 'notifications', label: t('drawer.notifications'), route: '/notifications', badge: unreadCount, dividerAfter: true },
  ];

  const primaryItems = activeWorkspace === 'owner'
    ? ownerItems
    : activeWorkspace === 'pg'
      ? pgItems
      : tenantItems;

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
            width: drawerWidth,
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

          {/* Workspace badge / switcher */}
          {isOwner && (
            <View style={styles.workspaceRow}>
              <TouchableOpacity
                style={styles.workspaceBadge}
                onPress={() => isMultiRole && setShowWorkspacePicker(true)}
                activeOpacity={isMultiRole ? 0.7 : 1}
              >
                <Ionicons
                  name={activeWorkspace === 'owner' ? 'business' : activeWorkspace === 'pg' ? 'bed' : 'home'}
                  size={13}
                  color="rgba(255,255,255,0.9)"
                />
                  <Text style={styles.workspaceBadgeText}>
                  {activeWorkspace === 'owner' ? t('drawer.ownerWorkspace') : activeWorkspace === 'pg' ? t('pg.drawer.workspace') : t('drawer.tenantWorkspace')}
                </Text>
                {isMultiRole && (
                  <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.9)" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* Menu Items */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8 }}
        >
          {/* Primary nav items */}
          {primaryItems.map((item, index) => (
            <React.Fragment key={`primary-${index}`}>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => item.onPress ? item.onPress() : item.route && navigate(item.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, { backgroundColor: themeColors.primaryLight + '30' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color || themeColors.primary} />
                </View>
                <View style={styles.drawerItemLabelWrap}>
                  <Text style={[styles.drawerItemLabel, { color: themeColors.text.primary }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.premium && <PremiumTag small />}
                </View>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <View style={[styles.drawerBadge, { backgroundColor: themeColors.error }]}>
                    <Text style={styles.drawerBadgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={themeColors.text.tertiary} />
              </TouchableOpacity>
              {item.dividerAfter && (
                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              )}
            </React.Fragment>
          ))}

          {/* Shared items */}
          {sharedItems.map((item, index) => (
            <React.Fragment key={`shared-${index}`}>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => item.onPress ? item.onPress() : item.route && navigate(item.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, { backgroundColor: themeColors.primaryLight + '30' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color || themeColors.primary} />
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
            <Text style={[styles.drawerItemLabel, { color: '#EF4444' }]}>{t('drawer.logout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      <WorkspacePicker
        visible={showWorkspacePicker}
        onClose={() => {
          setShowWorkspacePicker(false);
          onClose();
          const { activeWorkspace: ws } = useAuthStore.getState();
          setTimeout(() => {
            if (ws === 'owner') router.replace('/(owner-tabs)' as any);
            else if (ws === 'pg') router.replace('/(pg-tabs)' as any);
            else router.replace('/(tabs)' as any);
          }, 300);
        }}
      />
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
    zIndex: 999,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  workspaceRow: {
    marginTop: 14,
  },
  workspaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  workspaceBadgeText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
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
  drawerItemLabelWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
});
