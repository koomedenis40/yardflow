import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import type { PaymentMethod } from '../../types/api';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'mobile_money_manual', label: 'Mobile money (manual)' },
  { value: 'other_manual', label: 'Other' },
];

interface MethodPickerProps {
  label?: string;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  error?: string | null;
}

export function MethodPicker({ label = 'Payment method', value, onChange, error }: MethodPickerProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.grid}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.chip, value === m.value && styles.chipSelected]}
            onPress={() => onChange(m.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, value === m.value && styles.chipTextSelected]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing[4] },
  label: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.green[800],
    backgroundColor: colors.green[100],
  },
  chipText: { fontSize: fontSize.bodySm, color: colors.neutral[700], fontWeight: fontWeight.medium },
  chipTextSelected: { color: colors.green[900] },
  errorText: { marginTop: 4, fontSize: fontSize.caption, color: colors.red[700] },
});
