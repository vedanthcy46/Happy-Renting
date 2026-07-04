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
    />
  );
}
