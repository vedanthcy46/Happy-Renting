import { useRouter } from 'expo-router';
import { OwnerDashboardScreen } from '../../src/screens/owner/OwnerDashboardScreen';

export default function OwnerDashboardTab() {
  const router = useRouter();
  return (
    <OwnerDashboardScreen
      onNavigate={(screen, params) => {
        switch (screen) {
          case 'notifications':
            router.navigate('/notifications' as any);
            break;
          case 'properties':
            router.navigate('/(owner-tabs)/properties' as any);
            break;
          case 'tenants':
            router.navigate('/(owner-tabs)/tenants' as any);
            break;
          case 'payments':
            router.navigate('/(owner-tabs)/payments' as any);
            break;
        }
      }}
    />
  );
}
