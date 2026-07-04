import { useRouter } from 'expo-router';
import { LoginScreen } from '../src/screens/LoginScreen';

export default function LoginPage() {
  const router = useRouter();
  return <LoginScreen onLoginSuccess={() => router.replace('/(tabs)')} />;
}
