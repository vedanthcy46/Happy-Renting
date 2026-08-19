import { useEffect, useState, useRef, useCallback } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { fontAssets } from '../src/theme/typography';
import 'react-native-reanimated';
import { useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Alert, View, Text, TouchableOpacity, Animated, LogBox } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/store/useAuthStore';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { markAsRead } from '../src/api/notifications';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { appEvents, SESSION_EXPIRED_EVENT, OPEN_DRAWER_EVENT } from '../src/utils/events';
import { isBiometricEnabled, authenticateWithBiometric } from '../src/hooks/useBiometric';
import { OfflineBanner, AppDrawer, AiLauncher } from '../src/components';
import { WorkspacePicker } from '../src/components/WorkspacePicker';
import { queryClient } from '../src/queryClient';
import { sqlitePersister } from '../src/persist/sqlitePersister';
import { startSyncEngine } from '../src/sync/syncEngine';
import { initializeLanguage } from '../src/localization';

const ONBOARDING_KEY = 'onboarding_completed';
const CACHE_BUSTER = 'v1';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet.",
]);

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function AppContent() {
  const { initialize, isLoading: isAuthLoading, user, token, activeWorkspace, needsWorkspacePicker } = useAuthStore();
  const { colors: themeColors } = useTheme();
  const isRestoring = useIsRestoring();
  const [isLocked, setIsLocked] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  const router = useRouter();
  const pathname = usePathname();
  const pendingNotification = useRef<any>(null);

  const handleNotificationTap = useCallback((data: any) => {
    const notificationId = data?.notificationId;
    if (notificationId) {
      markAsRead(notificationId).catch(() => { });
    }

    const rentRecordId = data?.rentRecordId;
    const complaintId = data?.complaintId;

    const navigate = () => {
      const { activeWorkspace: ws } = useAuthStore.getState();
      if (rentRecordId) {
        // Rent detail is only meaningful for tenants
        router.navigate(`/rentDetail/${rentRecordId}` as any);
      } else if (complaintId) {
        // Route to the correct workspace's complaints tab
        if (ws === 'owner') {
          router.navigate('/(owner-tabs)/tenants' as any); // Phase 3: dedicated complaints tab
        } else {
          router.navigate('/(tabs)/complaints' as any);
        }
      } else {
        router.navigate('/notifications' as any);
      }
    };

    const { user: u, token: t } = useAuthStore.getState();
    if (!u || !t) {
      pendingNotification.current = { rentRecordId, complaintId };
      return;
    }
    navigate();
  }, [router]);

  usePushNotifications(handleNotificationTap);

  useEffect(() => {
    if (user && token && pendingNotification.current) {
      const pending = pendingNotification.current;
      pendingNotification.current = null;
      if (pending.rentRecordId) {
        router.navigate(`/rentDetail/${pending.rentRecordId}` as any);
      } else if (pending.complaintId) {
        if (activeWorkspace === 'owner') {
          router.navigate('/(owner-tabs)/tenants' as any);
        } else {
          router.navigate('/(tabs)/complaints' as any);
        }
      } else {
        router.navigate('/notifications' as any);
      }
    }
  }, [user, token, activeWorkspace, router]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    initializeLanguage().then(() => setLanguageReady(true));
  }, []);

  useEffect(() => {
    if (user && token) {
      startSyncEngine();
    }
  }, [user, token]);

  // Check onboarding flag and redirect if needed.
  // Workspace landing is handled declaratively by the (tabs) / (owner-tabs)
  // layout guards, so no imperative redirect lives here anymore.
  useEffect(() => {
    const checkOnboarding = async () => {
      if (isAuthLoading) return;

      // Already authenticated — never send a logged-in user back to onboarding.
      if (!user || !token) {
        try {
          const completed = await SecureStore.getItemAsync(ONBOARDING_KEY);
          if (!completed) {
            router.replace('/onboarding');
          }
        } catch {
        }
      }
      setOnboardingChecked(true);
    };
    checkOnboarding();
  }, [isAuthLoading, user, token, router]);

  useEffect(() => {
    if (!isAuthLoading && onboardingChecked && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync();
    }
  }, [isAuthLoading, onboardingChecked, fontsLoaded, fontError]);

    const sessionExpiredShown = useRef(false);

  useEffect(() => {
    const handleSessionExpired = () => {
      // Guard: only show the alert once per session expiry cycle
      if (sessionExpiredShown.current) return;
      sessionExpiredShown.current = true;

      Alert.alert(
        'Session Expired',
        'Your session has expired. Please sign in again.',
        [{
          text: 'OK',
          onPress: () => {
            sessionExpiredShown.current = false; // Reset for future sessions
            router.replace('/login');
          },
        }]
      );
    };

    appEvents.on(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      appEvents.off(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [router]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTranslateX = useRef(new Animated.Value(-400)).current;
  const drawerOverlayOpacity = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(drawerOverlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerTranslateX, drawerOverlayOpacity]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.spring(drawerTranslateX, {
        toValue: -400,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(drawerOverlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setDrawerOpen(false));
  }, [drawerTranslateX, drawerOverlayOpacity]);

  useEffect(() => {
    appEvents.on(OPEN_DRAWER_EVENT, openDrawer);
    return () => {
      appEvents.off(OPEN_DRAWER_EVENT, openDrawer);
    };
  }, [openDrawer]);

  useEffect(() => {
    if (isLocked) closeDrawer();
  }, [isLocked, closeDrawer]);

  const hasCheckedLock = useRef(false);

  useEffect(() => {
    const checkLockStatus = async () => {
      if (isAuthLoading) return;
      if (hasCheckedLock.current) return;

      if (user && token) {
        const isEnabled = await isBiometricEnabled();
        if (isEnabled) {
          hasCheckedLock.current = true;
          setIsLocked(true);
          const success = await authenticateWithBiometric();
          if (success) {
            setIsLocked(false);
          }
        } else {
          hasCheckedLock.current = true;
        }
      } else {
        hasCheckedLock.current = true;
      }
      setCheckingBiometric(false);
    };

    checkLockStatus();
  }, [isAuthLoading, user, token]);

  const isReady = !isAuthLoading && !checkingBiometric && onboardingChecked && languageReady && (fontsLoaded || !!fontError) && !isRestoring;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: themeColors.background },
        animation: 'slide_from_right',
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(owner-tabs)" />
        <Stack.Screen name="(pg-tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="rentDetail/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="help" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="terms-of-service" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="transaction-history" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ai" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="owner-request" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {!isReady && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.background }]} />
      )}
      {isReady && isLocked && (
        <View style={[StyleSheet.absoluteFill, styles.lockContainer, { backgroundColor: themeColors.background }]}>
          <View style={styles.lockContent}>
            <View style={[styles.lockIconContainer, { backgroundColor: themeColors.primary + '15' }]}>
              <Ionicons name="lock-closed" size={48} color={themeColors.primary} />
            </View>
            <Text style={[styles.lockTitle, { color: themeColors.text.primary }]}>App Locked</Text>
            <Text style={[styles.lockSubtitle, { color: themeColors.text.secondary }]}>
              Please authenticate using biometrics to open Happy Renting
            </Text>
            <TouchableOpacity
              style={[styles.unlockBtn, { backgroundColor: themeColors.primary }]}
              onPress={async () => {
                const success = await authenticateWithBiometric();
                if (success) setIsLocked(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="finger-print" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.unlockBtnText}>Unlock App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.lockLogoutBtn}
              onPress={async () => {
                await useAuthStore.getState().logout();
                setIsLocked(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: themeColors.primary, fontWeight: '600', fontSize: 14 }}>
                Sign out and login with password
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {isReady && !isLocked && <OfflineBanner />}
      {isReady && !isLocked && <AiLauncher />}
      {isReady && !isLocked && (
        <WorkspacePicker
          visible={needsWorkspacePicker}
          required
          onClose={() => {
            const { activeWorkspace: ws } = useAuthStore.getState();
            if (ws === 'owner') router.replace('/(owner-tabs)' as any);
            else if (ws === 'pg') router.replace('/(pg-tabs)' as any);
            else router.replace('/(tabs)' as any);
          }}
        />
      )}
      {isReady && !isLocked && (
        <AppDrawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          translateX={drawerTranslateX}
          overlayOpacity={drawerOverlayOpacity}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: sqlitePersister,
          maxAge: CACHE_MAX_AGE,
          buster: CACHE_BUSTER,
        }}
      >
        <ThemeProvider>
          <GestureHandlerRootView style={styles.root}>
            <AppContent />
          </GestureHandlerRootView>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  lockContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
  },
  lockIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  lockLogoutBtn: {
    paddingVertical: 12,
  },
});
