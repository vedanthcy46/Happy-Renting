import { useLocalSearchParams, useRouter } from 'expo-router';
import { BillDetailScreen } from '../../../src/screens/owner/BillDetailScreen';

export default function BillDetailRoute() {
  const { billId } = useLocalSearchParams<{ billId: string }>();
  return <BillDetailScreen billId={billId} />;
}
