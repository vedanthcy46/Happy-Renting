import { useRouter } from 'expo-router';
import { TermsOfServiceScreen } from '../src/screens/TermsOfServiceScreen';

export default function TermsOfService() {
  const router = useRouter();
  return <TermsOfServiceScreen onBack={() => router.back()} />;
}
