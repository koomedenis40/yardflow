import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth-context';

function NavigationGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(tabs)';
    if (!session && inAuthGroup) {
      router.replace('/login');
    } else if (session && !inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationGuard />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="stock"
            options={{ headerShown: true, title: 'Stock on Hand', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="more/suppliers"
            options={{ headerShown: true, title: 'Suppliers', headerBackTitle: 'More' }}
          />
          <Stack.Screen
            name="more/buyers"
            options={{ headerShown: true, title: 'Buyers', headerBackTitle: 'More' }}
          />
          <Stack.Screen
            name="more/categories"
            options={{ headerShown: true, title: 'Categories', headerBackTitle: 'More' }}
          />
          <Stack.Screen
            name="more/settings"
            options={{ headerShown: true, title: 'Settings', headerBackTitle: 'More' }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
