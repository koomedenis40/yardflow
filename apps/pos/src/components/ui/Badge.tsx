import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius } from '@yardflow/theme';
import type { PaymentStatus } from '../../types/api';

interface BadgeProps {
  status: PaymentStatus | 'error';
}

const LABEL: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  error: 'Error',
};

export function Badge({ status }: BadgeProps) {
  return (
    <View style={[styles.base, styles[status]]}>
      <Text style={textStyles[status]}>{LABEL[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  paid: { backgroundColor: colors.green[100] },
  partial: { backgroundColor: colors.amber.bg },
  unpaid: { backgroundColor: colors.neutral[100] },
  error: { backgroundColor: colors.red[100] },
});

const textStyles = StyleSheet.create({
  paid: { color: colors.green[900], fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  partial: { color: colors.amber.text, fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  unpaid: { color: colors.muted, fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  error: { color: colors.red[700], fontSize: fontSize.caption, fontWeight: fontWeight.medium },
});
