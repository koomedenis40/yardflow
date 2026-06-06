import { StyleSheet, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { Text } from './Text';

type Tone = 'default' | 'green' | 'blue' | 'amber' | 'featured';

interface KpiProps {
  label: string;
  value: string;
  tone?: Tone;
  sublabel?: string;
}

export function Kpi({ label, value, tone = 'default', sublabel }: KpiProps) {
  const isFeatured = tone === 'featured';
  return (
    <View style={[styles.card, toneStyles[tone]]}>
      <Text
        variant="caption"
        style={isFeatured ? [styles.label, styles.labelFeatured] : styles.label}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        variant="kpiSm"
        style={isFeatured ? [styles.value, styles.valueFeatured] : styles.value}
        numberOfLines={1}
      >
        {value}
      </Text>
      {sublabel ? (
        <Text
          variant="caption"
          style={isFeatured ? [styles.sublabel, styles.labelFeatured] : styles.sublabel}
        >
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    flex: 1,
    minHeight: 88,
    justifyContent: 'center',
    elevation: 1,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  label: {
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  value: {},
  sublabel: { marginTop: 2 },
  labelFeatured: { color: 'rgba(255,255,255,0.7)' },
  valueFeatured: { color: '#fff' },
});

const toneStyles = StyleSheet.create({
  default: { backgroundColor: colors.surface },
  green: { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.green[800] },
  blue: { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.blue[700] },
  amber: { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.amber.text },
  featured: {
    backgroundColor: colors.green[900],
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
  },
});
