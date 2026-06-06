import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth-context';
import { LoadingView } from '../src/components/ui';

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <LoadingView message="Starting YardFlow…" />;
  if (session) return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}
