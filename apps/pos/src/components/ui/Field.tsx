import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  editable?: boolean;
  error?: string | null;
  hint?: string;
  suffix?: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
  onSubmitEditing?: () => void;
  multiline?: boolean;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry,
  autoCapitalize,
  editable = true,
  error,
  hint,
  suffix,
  style,
  inputStyle,
  returnKeyType,
  onSubmitEditing,
  multiline,
}: FieldProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputError : null, !editable && styles.inputDisabled]}>
        <TextInput
          style={[styles.input, suffix ? styles.inputWithSuffix : null, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
          editable={editable}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          multiline={multiline}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing[4] },
  label: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.medium,
    color: colors.neutral[700],
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  inputError: { borderColor: colors.red[700] },
  inputDisabled: { backgroundColor: colors.neutral[100] },
  input: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.body,
    color: colors.text,
    minHeight: 48,
  },
  inputWithSuffix: { paddingRight: 0 },
  suffix: {
    paddingRight: spacing[4],
    fontSize: fontSize.body,
    color: colors.muted,
  },
  errorText: {
    marginTop: 4,
    fontSize: fontSize.caption,
    color: colors.red[700],
  },
  hintText: {
    marginTop: 4,
    fontSize: fontSize.caption,
    color: colors.muted,
  },
});
