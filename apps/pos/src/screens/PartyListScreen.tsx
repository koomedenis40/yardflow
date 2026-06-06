import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getBuyers, getSuppliers } from '../lib/services';
import { formatMoney } from '../lib/format';
import type { Buyer, Supplier } from '../types/api';
import { Badge, EmptyState, ErrorNote, LoadingView, OfflineBanner } from '../components/ui';

type Mode = 'suppliers' | 'buyers';

interface PartyListScreenProps {
  mode: Mode;
}

export function PartyListScreen({ mode }: PartyListScreenProps) {
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<(Supplier | Buyer)[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data =
        mode === 'suppliers'
          ? await getSuppliers(accessToken)
          : await getBuyers(accessToken);
      setItems(data);
      setError(null);
    } catch {
      setError(`Failed to load ${mode}`);
    }
  }, [accessToken, mode]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <LoadingView message={`Loading ${mode}…`} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />

      <View style={styles.searchRow}>
        <Search size={16} color={colors.muted} strokeWidth={1.75} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${mode}…`}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {error ? <View style={styles.errorWrap}><ErrorNote message={error} /></View> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green[800]} />
        }
        ListEmptyComponent={<EmptyState message={`No ${mode} found`} />}
        renderItem={({ item }) => {
          const balance = Number(item.balanceKes);
          const isSupplier = mode === 'suppliers';
          const credit = isSupplier ? Number((item as Supplier).creditBalanceKes) : 0;

          return (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.content}>
                <Text style={styles.name}>{item.name}</Text>
                {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
              </View>
              <View style={styles.right}>
                {balance > 0 ? (
                  <Text style={[styles.balance, isSupplier ? styles.balanceAmber : styles.balanceBlue]}>
                    {formatMoney(balance)}
                  </Text>
                ) : null}
                {credit > 0 ? (
                  <Text style={styles.credit}>{formatMoney(credit)} cr</Text>
                ) : null}
                {!item.isActive ? (
                  <Badge status="unpaid" />
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing[4],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: fontSize.body, color: colors.text },
  errorWrap: { paddingHorizontal: spacing[4] },
  list: { paddingHorizontal: spacing[4], gap: 8, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    elevation: 1,
    gap: spacing[3],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold, color: colors.neutral[700] },
  content: { flex: 1 },
  name: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  phone: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  balance: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold },
  balanceAmber: { color: colors.amber.text },
  balanceBlue: { color: colors.blue[700] },
  credit: { fontSize: fontSize.caption, color: colors.green[800] },
});
