import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { ChevronRight } from 'lucide-react-native';

interface SectionProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Section({ title, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.title}>{title.toUpperCase()}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
}

export function Row({ label, value, onPress, destructive, chevron = !!onPress }: RowProps) {
  const content = (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {chevron ? <ChevronRight size={16} color={colors.muted} strokeWidth={1.75} /> : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing[6] },
  title: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  body: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    minHeight: 50,
  },
  rowLabel: { flex: 1, fontSize: fontSize.body, color: colors.text },
  rowLabelDestructive: { color: colors.red[700] },
  rowValue: { fontSize: fontSize.body, color: colors.muted, marginRight: 4, maxWidth: 180 },
});
