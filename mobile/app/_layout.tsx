import { useEffect, useState, useRef, useCallback } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { fontAssets } from '../src/theme/typography';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Alert, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/store/useAuthStore';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { markAsRead } from '../src/api/notifications';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { colors } from '../src/theme';
import { appEvents, SESSION_EXPIRED_EVENT } from '../src/utils/events';
import { isBiometricEnabled, authenticateWithBiometric } from '../src/hooks/useBiometric';
import { OfflineBanner } from '../src/components';

const ONBOARDING_KEY = 'onboarding_completed';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function AppContent() {
  const { initialize, isLoading: isAuthLoading, user, token } = useAuthStore();
  const { colors: themeColors } = useTheme();
  const [isLocked, setIsLocked] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  const router = useRouter();
  const pathname = usePathname();
  const pendingNotification = useRef<any>(null);

  const handleNotificationTap = useCallback((data: any) => {
    const notificationId = data?.notificationId;
    if (notificationId) {
      markAsRead(notificationId).catch(() => {});
    }

    const rentRecordId = data?.rentRecordId;
    const complaintId = data?.complaintId;

    const navigate = () => {
      if (rentRecordId) {
        router.navigate(`/rentDetail/${rentRecordId}` as any);
      } else if (complaintId) {
        router.navigate('/(tabs)/complaints' as any);
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
        router.navigate('/(tabs)/complaints' as any);
      } else {
        router.navigate('/notifications' as any);
      }
    }
  }, [user, token, router]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Check onboarding flag and redirect if needed
  useEffect(() => {
    const checkOnboarding = async () => {
      if (isAuthLoading) return;

      try {
        const completed = await SecureStore.getItemAsync(ONBOARDING_KEY);
        if (!completed) {
          router.replace('/onboarding');
        }
      } catch {
      } finally {
        setOnboardingChecked(true);
      }
    };
    checkOnboarding();
  }, [isAuthLoading, router]);

  useEffect(() => {
    if (!isAuthLoading && onboardingChecked && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync();
    }
  }, [isAuthLoading, onboardingChecked, fontsLoaded, fontError]);

  useEffect(() => {
    const handleSessionExpired = () => {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please sign in again.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    };

    appEvents.on(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      appEvents.off(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [router]);

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

  if (isAuthLoading || checkingBiometric || !onboardingChecked || (!fontsLoaded && !fontError)) {
    return null;
  }

  if (isLocked) {
    return (
      <View style={[styles.lockContainer, { backgroundColor: themeColors.background }]}>
        <StatusBar style="auto" />
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
              if (success) {
                setIsLocked(false);
              }
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
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <OfflineBanner />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: themeColors.background },
        animation: 'slide_from_right',
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="rentDetail/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="help" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="terms-of-service" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="transaction-history" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <GestureHandlerRootView style={styles.root}>
            <AppContent />
          </GestureHandlerRootView>
        </ThemeProvider>
      </QueryClientProvider>
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
