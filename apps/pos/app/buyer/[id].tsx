import { useLocalSearchParams } from 'expo-router';
import { BuyerDetailScreen } from '../../src/screens/BuyerDetailScreen';

export default function BuyerDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BuyerDetailScreen id={id} />;
}
