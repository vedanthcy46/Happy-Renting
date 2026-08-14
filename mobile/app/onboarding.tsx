import { OnboardingScreen } from '../src/screens/OnboardingScreen';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/store/useAuthStore';

const ONBOARDING_KEY = 'onboarding_completed';

export default function OnboardingRoute() {
  const router = useRouter();
  const { user, token, activeWorkspace } = useAuthStore();

  // If onboarding was already completed (or the user is authenticated), this
  // screen should never be shown — bounce to the correct destination. This also
  // prevents Android back-navigation from landing on a finished walkthrough.
  useEffect(() => {
    (async () => {
      const completed = await SecureStore.getItemAsync(ONBOARDING_KEY);
      if (completed || (user && token)) {
        if (user && token) {
          router.replace(activeWorkspace === 'owner' ? ('/(owner-tabs)' as any) : ('/(tabs)' as any));
        } else {
          router.replace('/login');
        }
      }
    })();
  }, [user, token, activeWorkspace, router]);

  return <OnboardingScreen onComplete={() => router.replace('/login')} />;
}
