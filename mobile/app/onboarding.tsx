import { OnboardingScreen } from '../src/screens/OnboardingScreen';
import { useRouter } from 'expo-router';

export default function OnboardingRoute() {
  const router = useRouter();
  return <OnboardingScreen onComplete={() => router.replace('/login')} />;
}
