import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package } from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getInventory } from '../lib/services';
import { formatMoney, formatWeight } from '../lib/format';
import type { InventoryItem } from '../types/api';
import { EmptyState, ErrorNote, LoadingView, OfflineBanner } from '../components/ui';

export function StockScreen() {
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const inv = await getInventory(accessToken);
      setInventory(inv.filter((i) => Number(i.weightKg) > 0));
      setError(null);
    } catch {
      setError('Failed to load inventory');
    }
  }, [accessToken]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) return <LoadingView message="Loading inventory…" />;

  const totalKg = inventory.reduce((s, i) => s + Number(i.weightKg), 0);
  const totalValue = inventory.reduce(
    (s, i) => s + Number(i.weightKg) * Number(i.avgCostKes),
    0,
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stock on Hand</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.totalKg}>{formatWeight(totalKg)}</Text>
          <Text style={styles.totalValue}>Est. {formatMoney(totalValue)}</Text>
        </View>
      </View>

      {error ? <View style={styles.errorWrap}><ErrorNote message={error} /></View> : null}

      <FlatList
        data={inventory.sort((a, b) => Number(b.weightKg) - Number(a.weightKg))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green[800]} />
        }
        ListEmptyComponent={<EmptyState message="No stock on hand" />}
        renderItem={({ item }) => {
          const estValue = Number(item.weightKg) * Number(item.avgCostKes);
          return (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <Package size={18} color={colors.green[800]} strokeWidth={1.75} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardName}>{item.category?.name ?? 'Unknown'}</Text>
                <Text style={styles.cardMeta}>
                  Avg cost {formatMoney(item.avgCostKes)}/kg
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardKg}>{formatWeight(item.weightKg)}</Text>
                <Text style={styles.cardValue}>{formatMoney(estValue)}</Text>
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
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 4 },
  headerMeta: { flexDirection: 'row', gap: 12, alignItems: 'baseline' },
  totalKg: { fontSize: fontSize.h1, fontWeight: fontWeight.semibold, color: colors.green[800] },
  totalValue: { fontSize: fontSize.body, color: colors.muted },
  errorWrap: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  list: { padding: spacing[4], gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    elevation: 1,
    gap: spacing[3],
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardName: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  cardMeta: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardKg: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold, color: colors.text },
  cardValue: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
});
