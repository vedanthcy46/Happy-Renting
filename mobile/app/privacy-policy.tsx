import { useRouter } from 'expo-router';
import { PrivacyPolicyScreen } from '../src/screens/PrivacyPolicyScreen';

export default function PrivacyPolicy() {
  const router = useRouter();
  return <PrivacyPolicyScreen onBack={() => router.back()} />;
}
