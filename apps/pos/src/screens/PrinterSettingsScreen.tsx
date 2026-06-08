import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bluetooth, BluetoothOff, CheckCircle, Printer, RefreshCw } from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { usePrinter } from '../printing/printer.context';
import { isBluetoothAvailable, type BTPrinterDevice } from '../printing/printer.service';
import { Text, Button, ErrorNote, OfflineBanner } from '../components/ui';

const TEST_RECEIPT = {
  type: 'purchase' as const,
  yardName: 'YardFlow POS',
  title: 'TEST PRINT',
  referenceId: '#TEST0001',
  dateTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
  cashierName: 'Printer Test',
  partyLabel: 'Printer',
  partyName: 'Connected',
  lines: [{ label: 'Status', value: 'OK' }],
  totalLabel: 'Result',
  totalValue: 'Success',
  methodValue: 'Bluetooth',
  footer: 'Printer is working!',
};

export function PrinterSettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    savedDevice,
    pairedDevices,
    isScanning,
    printStatus,
    printError,
    btAvailable,
    scanPairedDevices,
    selectDevice,
    clearDevice,
    printReceipt,
    resetPrintStatus,
  } = usePrinter();

  useEffect(() => {
    if (btAvailable) void scanPairedDevices();
  }, [btAvailable, scanPairedDevices]);

  const handleSelect = async (device: BTPrinterDevice) => {
    await selectDevice(device);
    resetPrintStatus();
  };

  const isPrinting = printStatus === 'connecting' || printStatus === 'printing';

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* BT unavailable banner */}
        {!btAvailable && (
          <View style={styles.noBtBanner}>
            <BluetoothOff size={20} color={colors.amber.text} strokeWidth={1.75} />
            <Text variant="bodySm" style={styles.noBtText}>
              Bluetooth is not available in Expo Go. Build a dev client to enable printing.
            </Text>
          </View>
        )}

        {/* Selected printer */}
        <View style={styles.section}>
          <Text variant="caption" muted style={styles.sectionTitle}>SELECTED PRINTER</Text>
          <View style={styles.card}>
            {savedDevice ? (
              <View style={styles.deviceRow}>
                <Printer size={20} color={colors.green[800]} strokeWidth={1.75} />
                <View style={styles.deviceInfo}>
                  <Text variant="body" bold>{savedDevice.name}</Text>
                  <Text variant="caption" muted>{savedDevice.address}</Text>
                </View>
                <TouchableOpacity onPress={() => void clearDevice()} style={styles.clearBtn}>
                  <Text variant="caption" style={styles.clearText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noDevice}>
                <Bluetooth size={20} color={colors.muted} strokeWidth={1.75} />
                <Text variant="bodySm" muted>No printer selected</Text>
              </View>
            )}
          </View>
        </View>

        {/* Test print */}
        {savedDevice && (
          <View style={styles.section}>
            <Button
              label={isPrinting ? 'Printing…' : printStatus === 'success' ? 'Printed ✓' : 'Test Print'}
              onPress={() => void printReceipt(TEST_RECEIPT)}
              loading={isPrinting}
              variant={printStatus === 'success' ? 'secondary' : 'primary'}
              fullWidth
            />
            {printStatus === 'error' && printError && <ErrorNote message={printError} />}
          </View>
        )}

        {/* Paired devices list */}
        {btAvailable && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" muted style={styles.sectionTitle}>PAIRED BLUETOOTH DEVICES</Text>
              <TouchableOpacity
                onPress={() => void scanPairedDevices()}
                disabled={isScanning}
                style={styles.refreshBtn}
              >
                {isScanning
                  ? <ActivityIndicator size="small" color={colors.green[800]} />
                  : <RefreshCw size={16} color={colors.green[800]} strokeWidth={1.75} />
                }
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              {pairedDevices.length === 0 ? (
                <View style={styles.noDevice}>
                  <Text variant="bodySm" muted>
                    {isScanning ? 'Scanning…' : 'No paired devices found. Pair your printer in Android Bluetooth Settings first.'}
                  </Text>
                </View>
              ) : (
                pairedDevices.map((device, i) => {
                  const isSelected = savedDevice?.address === device.address;
                  return (
                    <TouchableOpacity
                      key={device.address}
                      style={[
                        styles.pairedRow,
                        i < pairedDevices.length - 1 && styles.pairedRowBorder,
                        isSelected && styles.pairedRowSelected,
                      ]}
                      onPress={() => void handleSelect(device)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.deviceInfo}>
                        <Text variant="body" bold={isSelected}>{device.name}</Text>
                        <Text variant="caption" muted>{device.address}</Text>
                      </View>
                      {isSelected && (
                        <CheckCircle size={18} color={colors.green[800]} strokeWidth={1.75} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.hint}>
          <Text variant="caption" muted>
            1. Pair your printer in Android Settings → Bluetooth{'\n'}
            2. Tap the printer in the list above to select it{'\n'}
            3. Use Test Print to confirm it works{'\n'}
            4. Print buttons appear on every receipt screen
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing[4] },
  noBtBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.amber.bg,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  noBtText: { flex: 1, color: colors.amber.text, lineHeight: 18 },
  section: { marginBottom: spacing[4] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { letterSpacing: 0.8, marginBottom: 8 },
  refreshBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: 12,
  },
  deviceInfo: { flex: 1 },
  noDevice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing[4],
  },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearText: { color: colors.red[700] },
  pairedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    minHeight: 56,
  },
  pairedRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  pairedRowSelected: { backgroundColor: colors.green[50] },
  hint: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    marginTop: spacing[2],
  },
});
