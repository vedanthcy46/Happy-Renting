import { ProfileScreen } from '../../src/screens/ProfileScreen';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function ProfileTab() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return (
    <ProfileScreen
      onLogout={async () => {
        await logout();
        router.replace('/login');
      }}
      onNavigate={(screen, params) => {
        if (screen === 'privacy-policy') {
          router.navigate('/privacy-policy' as any);
        } else if (screen === 'terms-of-service') {
          router.navigate('/terms-of-service' as any);
        } else if (screen === 'settings') {
          router.navigate('/settings' as any);
        }
      }}
    />
  );
}
