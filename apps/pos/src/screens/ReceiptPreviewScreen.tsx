import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '@yardflow/theme';
import type { ReceiptData } from '../printing/receipt.types';

const COLS = 32;

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function rpad(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function row(label: string, value: string): string {
  const gap = COLS - label.length - value.length;
  if (gap < 1) return label.substring(0, COLS - value.length - 1) + ' ' + value;
  return label + ' '.repeat(gap) + value;
}

function center(s: string): string {
  const p = Math.max(0, Math.floor((COLS - s.length) / 2));
  return ' '.repeat(p) + s;
}

const DIV = '-'.repeat(COLS);

interface Props {
  receipt: ReceiptData;
}

export function ReceiptPreviewScreen({ receipt }: Props) {
  const insets = useSafeAreaInsets();

  const lines: string[] = [
    DIV,
    center(receipt.yardName),
    center(receipt.title),
    DIV,
    row('Date:', receipt.dateTime),
    row('Ref:', receipt.referenceId),
    row('Cashier:', receipt.cashierName),
    DIV,
    row(receipt.partyLabel + ':', receipt.partyName),
    ...receipt.lines.map((l) => row(l.label + ':', l.value)),
    DIV,
    row(receipt.totalLabel + ':', receipt.totalValue),
    ...(receipt.paidLabel && receipt.paidValue
      ? [row(receipt.paidLabel + ':', receipt.paidValue)]
      : []),
    row('Method:', receipt.methodValue),
    ...(receipt.statusValue ? [row('Status:', receipt.statusValue)] : []),
    ...(receipt.balanceLabel && receipt.balanceValue
      ? [DIV, row(receipt.balanceLabel + ':', receipt.balanceValue)]
      : []),
    DIV,
    center(receipt.footer.replace('\n', ' · ')),
    DIV,
  ];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + spacing[6] }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.paper}>
          {lines.map((line, i) => (
            <Text key={i} style={[styles.line, line === DIV && styles.divider]}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing[4] },
  paper: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: spacing[4],
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  line: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
    color: '#111',
    letterSpacing: 0,
  },
  divider: { color: colors.neutral[400] },
});
