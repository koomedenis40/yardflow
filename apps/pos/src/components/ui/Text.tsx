import { Text as RNText, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { colors, fontSize, fontWeight } from '@yardflow/theme';

type Variant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodySm'
  | 'caption'
  | 'kpi'
  | 'kpiSm';

interface TextProps {
  variant?: Variant;
  color?: string;
  bold?: boolean;
  muted?: boolean;
  children: React.ReactNode;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

const variantStyles: Record<Variant, TextStyle> = {
  h1: { fontSize: fontSize.h1, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: fontSize.h1 * 1.25 },
  h2: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: fontSize.h2 * 1.3 },
  h3: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: fontSize.h3 * 1.35 },
  body: { fontSize: fontSize.body, fontWeight: fontWeight.regular, color: colors.text, lineHeight: fontSize.body * 1.5 },
  bodySm: { fontSize: fontSize.bodySm, fontWeight: fontWeight.regular, color: colors.neutral[700], lineHeight: fontSize.bodySm * 1.45 },
  caption: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, color: colors.muted, lineHeight: fontSize.caption * 1.4 },
  kpi: { fontSize: fontSize.kpi, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: fontSize.kpi * 1.1 },
  kpiSm: { fontSize: fontSize.h1, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: fontSize.h1 * 1.1 },
};

export function Text({
  variant = 'body',
  color,
  bold,
  muted,
  children,
  numberOfLines,
  style,
}: TextProps) {
  const base = variantStyles[variant];
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        base,
        muted && styles.muted,
        bold && styles.bold,
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  bold: { fontWeight: fontWeight.semibold },
});
