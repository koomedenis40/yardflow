import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { useNetworkStatus } from '../lib/network';
import { count } from '../lib/offline-queue';
import { OfflineBanner, Row, Section, Text } from '../components/ui';

export function SettingsScreen() {
  const { session, logout } = useAuth();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  const [pendingCount, setPendingCount] = useState(0);

  const version = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const apiUrl = extra?.['apiUrl'] ?? 'http://10.0.2.2:3001/v1';

  useEffect(() => {
    void count().then(setPendingCount);
  }, []);

  const networkLabel = isConnected
    ? isInternetReachable
      ? 'Connected'
      : 'Limited'
    : 'Offline';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />

      <View style={styles.header}>
        <Text variant="h2">Settings</Text>
      </View>

      <View style={styles.content}>
        <Section title="Account">
          <Row label="Name" value={session?.user.fullName ?? '—'} />
          <Row label="Email" value={session?.user.email ?? '—'} />
          <Row label="Yard" value={session?.user.tenantSlug ?? '—'} />
          <Row label="Role" value={session?.user.role ?? '—'} />
        </Section>

        <Section title="Network">
          <Row label="Status" value={networkLabel} />
          <Row label="Pending mutations" value={String(pendingCount)} />
        </Section>

        <Section title="App">
          <Row label="Version" value={version} />
          <Row label="API endpoint" value={apiUrl} />
        </Section>

        <Section title="Session">
          <Row label="Sign out" destructive onPress={() => void logout()} />
        </Section>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: { flex: 1, padding: spacing[4] },
});
