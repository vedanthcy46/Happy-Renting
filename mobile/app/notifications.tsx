import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { useRouter } from 'expo-router';

export default function NotificationsPage() {
  const router = useRouter();
  return (
    <NotificationsScreen
      onBack={() => router.back()}
      onNavigate={(screen, params) => {
        if (screen === 'rentDetail') {
          router.navigate(`/rentDetail/${params?.rentRecordId}` as any);
        } else if (screen === 'complaints') {
          router.navigate('/(tabs)/complaints' as any);
        }
      }}
    />
  );
}
