import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle, Info } from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';

export function LoadingView({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.green[800]} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={styles.errorNote}>
      <AlertCircle size={16} color={colors.red[700]} strokeWidth={1.75} />
      <Text style={styles.errorNoteText}>{message}</Text>
    </View>
  );
}

export function SuccessNote({ message }: { message: string }) {
  return (
    <View style={styles.successNote}>
      <CheckCircle size={16} color={colors.green[800]} strokeWidth={1.75} />
      <Text style={styles.successNoteText}>{message}</Text>
    </View>
  );
}

export function InfoNote({ message }: { message: string }) {
  return (
    <View style={styles.infoNote}>
      <Info size={16} color={colors.blue[700]} strokeWidth={1.75} />
      <Text style={styles.infoNoteText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[4],
  },
  loadingText: { fontSize: fontSize.body, color: colors.muted, marginTop: spacing[3] },
  emptyText: { fontSize: fontSize.body, color: colors.muted, textAlign: 'center' },

  errorNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.red[100],
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  errorNoteText: { flex: 1, fontSize: fontSize.body, color: colors.red[700] },

  successNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.green[100],
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  successNoteText: { flex: 1, fontSize: fontSize.body, color: colors.green[900], fontWeight: fontWeight.medium },

  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.blue[100],
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  infoNoteText: { flex: 1, fontSize: fontSize.body, color: colors.blue[700] },
});
