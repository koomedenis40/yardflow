import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage } from '../lib/api';
import { Button, ErrorNote, Field } from '../components/ui';

export function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const [tenantSlug, setTenantSlug] = useState('demo-yard');
  const [email, setEmail] = useState('cashier@demo.local');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!tenantSlug.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password, tenantSlug.trim().toLowerCase());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>YF</Text>
        </View>
        <Text style={styles.brandName}>YardFlow</Text>
      </View>

      <Text style={styles.headline}>Sign in to your yard</Text>
      <Text style={styles.sub}>Enter your yard code, email, and password</Text>

      <View style={styles.form}>
        {error ? <ErrorNote message={error} /> : null}

        <Field
          label="Yard code"
          value={tenantSlug}
          onChangeText={setTenantSlug}
          placeholder="your-yard"
          autoCapitalize="none"
          keyboardType="default"
          returnKeyType="next"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="cashier@youryard.com"
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        <Button
          label="Sign in"
          onPress={handleLogin}
          loading={loading}
          fullWidth
          style={styles.submit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing[6],
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.green[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 16, fontWeight: fontWeight.bold },
  brandName: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
  headline: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 8,
  },
  sub: { fontSize: fontSize.body, color: colors.muted, marginBottom: 32 },
  form: {},
  submit: { marginTop: spacing[2] },
});
