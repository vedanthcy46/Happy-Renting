import { useLocalSearchParams } from 'expo-router';
import { OwnerTransactionDetailScreen } from '../../../src/screens/owner/OwnerTransactionDetailScreen';

export default function OwnerTransactionDetailRoute() {
  const { rentRecordId } = useLocalSearchParams<{ rentRecordId: string }>();
  return <OwnerTransactionDetailScreen rentRecordId={rentRecordId ?? ''} />;
}