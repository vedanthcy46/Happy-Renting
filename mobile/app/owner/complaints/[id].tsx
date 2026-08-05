import { useLocalSearchParams } from 'expo-router';
import { OwnerComplaintDetailScreen } from '../../../src/screens/owner/OwnerComplaintDetailScreen';

export default function OwnerComplaintDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OwnerComplaintDetailScreen id={id ?? ''} />;
}