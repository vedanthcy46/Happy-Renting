import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { useRouter } from 'expo-router';

export default function NotificationsPage() {
  const router = useRouter();
  return <NotificationsScreen onBack={() => router.back()} />;
}
