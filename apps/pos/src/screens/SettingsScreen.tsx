import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { useNetworkStatus } from '../lib/network';
import { count } from '../lib/offline-queue';
import { getApiBase, setApiBase } from '../lib/api';
import { OfflineBanner, Row, Section, Text } from '../components/ui';

export function SettingsScreen() {
  const { session, logout } = useAuth();
  const { isConnected, isInternetReachable } = useNetworkStatus();

  const [pendingCount, setPendingCount] = useState(0);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [currentUrl, setCurrentUrl] = useState(getApiBase());

  const version = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  useEffect(() => {
    void count().then(setPendingCount);
  }, []);

  const networkLabel = isConnected
    ? isInternetReachable
      ? 'Connected'
      : 'Limited'
    : 'Offline';

  const openUrlModal = () => {
    setUrlInput(getApiBase());
    setShowUrlModal(true);
  };

  const handleSaveUrl = async () => {
    await setApiBase(urlInput.trim() || getApiBase());
    setCurrentUrl(getApiBase());
    setShowUrlModal(false);
  };

  return (
    <View style={styles.container}>
      <OfflineBanner />

      <View style={styles.content}>
        <Section title="Appearance">
          <Row label="Dark mode" value="Coming soon" />
        </Section>

        <Section title="Account">
          <Row label="Name" value={session?.user.fullName ?? '—'} />
          <Row label="Email" value={session?.user.email ?? '—'} />
          <Row label="Yard" value={session?.user.tenantSlug ?? '—'} />
          <Row label="Role" value={session?.user.role ?? '—'} />
        </Section>

        <Section title="Network">
          <Row label="Status" value={networkLabel} />
          <Row label="Pending sync" value={String(pendingCount)} />
        </Section>

        <Section title="App">
          <Row label="Version" value={version} />
          <Row label="API endpoint" value={currentUrl} onPress={openUrlModal} chevron />
        </Section>

        <Section title="Session">
          <Row label="Sign out" destructive onPress={() => void logout()} />
        </Section>
      </View>

      {/* ── API URL edit modal ─────────────────────────────────────────── */}
      <Modal
        visible={showUrlModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUrlModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowUrlModal(false)}>
          <Pressable style={styles.sheet} onPress={() => { /* stop bubble */ }}>
            <Text variant="h2" style={styles.sheetTitle}>API Server</Text>
            <Text variant="caption" style={styles.sheetSub}>
              On a physical device, use your PC's LAN IP (e.g. http://192.168.1.x:3001/v1).{'\n'}
              On an emulator, keep http://10.0.2.2:3001/v1.
            </Text>

            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectTextOnFocus
              placeholder="http://192.168.1.x:3001/v1"
              placeholderTextColor={colors.muted}
            />

            <View style={styles.actions}>
              <Pressable
                onPress={() => setShowUrlModal(false)}
                style={[styles.btn, styles.btnCancel]}
              >
                <Text variant="body" style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { void handleSaveUrl(); }}
                style={[styles.btn, styles.btnSave]}
              >
                <Text variant="body" style={styles.btnSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, padding: spacing[4] },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[6],
    width: '100%',
    maxWidth: 400,
  },
  sheetTitle: { marginBottom: 8 },
  sheetSub: { lineHeight: 18, marginBottom: spacing[4], color: colors.muted },
  urlInput: {
    backgroundColor: colors.canvas,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.body,
    color: colors.text,
    fontFamily: 'monospace',
    marginBottom: spacing[4],
  },
  actions: { flexDirection: 'row', gap: spacing[3] },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  btnCancel: { backgroundColor: colors.neutral[100] },
  btnCancelText: { color: colors.neutral[700], fontWeight: fontWeight.medium },
  btnSave: { backgroundColor: colors.green[800] },
  btnSaveText: { color: '#fff', fontWeight: fontWeight.semibold },
});
