import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@yardflow/theme';
import { ReceiptPreviewScreen } from '../src/screens/ReceiptPreviewScreen';
import type { ReceiptData } from '../src/printing/receipt.types';

export default function ReceiptPreviewRoute() {
  const { receipt } = useLocalSearchParams<{ receipt: string }>();

  if (!receipt) {
    return (
      <View style={styles.err}>
        <Text style={styles.errText}>No receipt data provided.</Text>
      </View>
    );
  }

  let data: ReceiptData;
  try {
    data = JSON.parse(receipt) as ReceiptData;
  } catch {
    return (
      <View style={styles.err}>
        <Text style={styles.errText}>Invalid receipt data.</Text>
      </View>
    );
  }

  return <ReceiptPreviewScreen receipt={data} />;
}

const styles = StyleSheet.create({
  err: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas, padding: spacing[6] },
  errText: { color: colors.muted },
});
