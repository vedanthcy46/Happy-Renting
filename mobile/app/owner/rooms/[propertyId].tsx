import { useLocalSearchParams } from 'expo-router';
import { OwnerRoomsScreen } from '../../../src/screens/owner/OwnerRoomsScreen';

export default function OwnerRoomsRoute() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  return <OwnerRoomsScreen propertyId={propertyId ?? ''} />;
}