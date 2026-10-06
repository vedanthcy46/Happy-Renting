import { useLocalSearchParams } from 'expo-router';
import { CreateBillScreen } from '../../../src/screens/owner/CreateBillScreen';

export default function CreateBillRoute() {
  const params = useLocalSearchParams<{ billId?: string | string[] }>();
  const billId = Array.isArray(params.billId) ? params.billId[0] : params.billId;
  return <CreateBillScreen editBillId={billId} />;
}
