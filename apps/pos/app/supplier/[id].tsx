import { useLocalSearchParams } from 'expo-router';
import { SupplierDetailScreen } from '../../src/screens/SupplierDetailScreen';

export default function SupplierDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SupplierDetailScreen id={id} />;
}
