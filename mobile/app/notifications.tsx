import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';

export default function NotificationsPage() {
  const router = useRouter();
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const isOwner = activeWorkspace === 'owner';
  return (
    <NotificationsScreen
      onBack={() => router.back()}
      onNavigate={(screen, params) => {
        if (screen === 'rentDetail') {
          if (isOwner) {
            router.navigate(`/owner/transactions/${params?.rentRecordId}` as any);
          } else {
            router.navigate(`/rentDetail/${params?.rentRecordId}` as any);
          }
        } else if (screen === 'complaints') {
          if (isOwner) {
            router.navigate('/owner/complaints' as any);
          } else {
            router.navigate('/(tabs)/complaints' as any);
          }
        }
      }}
    />
  );
}
