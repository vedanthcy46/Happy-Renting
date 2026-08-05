import { useRouter } from 'expo-router';
import { LoginScreen } from '../src/screens/LoginScreen';

export default function LoginPage() {
  const router = useRouter();

  const handleLoginSuccess = (role: string) => {
    if (role === 'owner' || role === 'superadmin') {
      router.replace('/(owner-tabs)' as any);
    } else {
      router.replace('/(tabs)');
    }
  };

  return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
}
