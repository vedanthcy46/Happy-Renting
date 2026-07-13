import { useRouter, useLocalSearchParams } from 'expo-router';
import { ResetPasswordScreen } from '../src/screens/ResetPasswordScreen';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <ResetPasswordScreen
      token={token || ''}
      onBack={() => router.back()}
      onSuccess={() => router.replace('/login')}
    />
  );
}
