import { RentScreen } from '../../src/screens/RentScreen';
import { useRouter } from 'expo-router';

export default function RentTab() {
  const router = useRouter();
  return (
    <RentScreen
      onNavigate={(screen, params) => {
        if (screen === 'rentDetail') {
          router.navigate(`/rentDetail/${params?.rentRecordId}` as any);
        } else if (screen === 'transaction-history') {
          router.navigate('/transaction-history' as any);
        }
      }}
    />
  );
}
