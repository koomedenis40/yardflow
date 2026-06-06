import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@yardflow/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, style, padding = 'md' }: CardProps) {
  return (
    <View style={[styles.card, paddingStyles[padding], style]}>
      {children}
    </View>
  );
}

const paddingStyles = StyleSheet.create({
  sm: { padding: spacing[4] },
  md: { padding: spacing[6] },
  lg: { padding: spacing[8] },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    // React Native shadow (Android uses elevation)
    elevation: 2,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
});
