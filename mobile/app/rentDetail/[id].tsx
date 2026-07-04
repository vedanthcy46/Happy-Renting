import { useLocalSearchParams, useRouter } from 'expo-router';
import { RentDetailScreen } from '../../src/screens/RentDetailScreen';

export default function RentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <RentDetailScreen
      rentRecordId={id}
      onBack={() => router.back()}
    />
  );
}
