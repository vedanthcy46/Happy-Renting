import { HomeScreen } from '../../src/screens/HomeScreen';
import { useRouter } from 'expo-router';

export default function HomeTab() {
  const router = useRouter();
  return (
    <HomeScreen
      onNavigate={(screen, params) => {
        switch (screen) {
          case 'notifications':
            router.navigate('/notifications' as any);
            break;
          case 'rentDetail':
            router.navigate(`/rentDetail/${params?.rentRecordId}` as any);
            break;
          case 'rent':
            router.navigate('/(tabs)/rent' as any);
            break;
          case 'complaints':
            router.navigate('/(tabs)/complaints' as any);
            break;
        }
      }}
    />
  );
}
