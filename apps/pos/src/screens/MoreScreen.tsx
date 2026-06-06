import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { OfflineBanner, Section, Row, Text } from '../components/ui';
import Constants from 'expo-constants';

export function MoreScreen() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const version = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />
      <View style={styles.header}>
        <Text variant="h2">{session?.user.fullName ?? 'Cashier'}</Text>
        <Text variant="bodySm" muted>{session?.user.email ?? ''}</Text>
        <Text variant="caption" muted style={{ marginTop: 2 }}>{session?.user.tenantSlug ?? ''}</Text>
      </View>

      <View style={styles.scroll}>
        <Section title="Operations">
          <Row label="Suppliers" chevron onPress={() => router.push('/more/suppliers')} />
          <Row label="Buyers" chevron onPress={() => router.push('/more/buyers')} />
          <Row label="Categories" chevron onPress={() => router.push('/more/categories')} />
          <Row label="Stock" chevron onPress={() => router.push('/stock')} />
        </Section>

        <Section title="Account">
          <Row label="Settings" chevron onPress={() => router.push('/more/settings')} />
          <Row label="Sign out" destructive onPress={() => void logout()} />
        </Section>

        <Section title="App">
          <Row label="Version" value={version} />
          <Row label="API" value="10.0.2.2:3001" />
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
    marginBottom: spacing[4],
  },
  scroll: { flex: 1, paddingHorizontal: spacing[4] },
});
