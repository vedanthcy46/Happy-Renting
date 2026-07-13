import { useLocalSearchParams, useRouter } from 'expo-router';
import { ComplaintDetailScreen } from '../../src/screens/ComplaintDetailScreen';

export default function ComplaintDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) return null;

  return (
    <ComplaintDetailScreen
      complaintId={id}
      onBack={() => router.back()}
    />
  );
}
