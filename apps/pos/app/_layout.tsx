import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth-context';
import { PrinterProvider } from '../src/printing/printer.context';

void SplashScreen.preventAutoHideAsync();

function SplashGate() {
  const { isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);
  return null;
}

function NavigationGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inTabsGroup = segments[0] === '(tabs)';
    // Only handle two auth transitions:
    // 1. Unauthenticated user accessing tabs → send to login
    // 2. Authenticated user at root/login → send to tabs
    // Never redirect authenticated users away from non-tab routes (stock, more/*, etc.)
    const atRootOrLogin = !segments[0] || segments[0] === 'login';
    if (!session && inTabsGroup) {
      router.replace('/login');
    } else if (session && atRootOrLogin) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PrinterProvider>
          <SplashGate />
          <NavigationGuard />
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="receipt-preview"
              options={{ headerShown: true, title: 'Receipt Preview', headerBackTitle: 'Back' }}
            />
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
            <Stack.Screen
              name="more/printer"
              options={{ headerShown: true, title: 'Printer', headerBackTitle: 'More' }}
            />
            <Stack.Screen name="supplier/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="buyer/[id]" options={{ headerShown: false }} />
          </Stack>
        </PrinterProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
