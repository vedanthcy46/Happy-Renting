import { BillingScreen } from '../../src/screens/owner/BillingScreen';
import { useRouter } from 'expo-router';

export default function BillingTab() {
  const router = useRouter();
  return (
    <BillingScreen
      onNavigate={(screen, params) => {
        if (screen === 'billDetail') router.navigate(`/owner/billing/${params?.billId}` as any);
      }}
    />
  );
}
