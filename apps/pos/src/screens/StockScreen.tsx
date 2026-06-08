import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Package, Search, TrendingUp } from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getInventory } from '../lib/services';
import { formatMoney, formatWeight } from '../lib/format';
import type { InventoryItem } from '../types/api';
import { EmptyState, ErrorNote, LoadingView, OfflineBanner } from '../components/ui';

export function StockScreen() {
  const { accessToken } = useAuth();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const sorted = [...inventory].sort((a, b) => Number(b.weightKg) - Number(a.weightKg));
  const filtered = search.trim()
    ? sorted.filter((i) =>
        (i.category?.name ?? '').toLowerCase().includes(search.trim().toLowerCase()),
      )
    : sorted;

  return (
    <View style={styles.container}>
      <OfflineBanner />

      {/* Stats + search bar pinned below the native Stack header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.categoryCount}>
            {inventory.length} categor{inventory.length !== 1 ? 'ies' : 'y'}
          </Text>
          <View style={styles.headerStats}>
            <Text style={styles.totalKg}>{formatWeight(totalKg)}</Text>
            <Text style={styles.totalValue}>
              {totalValue > 0 ? `Est. ${formatMoney(totalValue)}` : 'Est. KES —'}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchBox}>
          <Search size={15} color={colors.muted} strokeWidth={1.75} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search category…"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {error ? <View style={styles.errorWrap}><ErrorNote message={error} /></View> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.categoryId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.green[800]}
          />
        }
        ListEmptyComponent={
          search.trim() ? (
            <EmptyState message={`No category matching "${search}"`} />
          ) : (
            <EmptyState message="No stock on hand" />
          )
        }
        renderItem={({ item }) => {
          const estValue = Number(item.weightKg) * Number(item.avgCostKes);
          const hasAvgCost = Number(item.avgCostKes) > 0;
          const name = item.category?.name ?? 'Unknown';
          return (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <Package size={18} color={colors.green[800]} strokeWidth={1.75} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardName}>{name}</Text>
                  <Text style={styles.cardKg}>{formatWeight(item.weightKg)}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardMeta}>
                    Avg cost {hasAvgCost ? `${formatMoney(item.avgCostKes)}/kg` : '—'}
                  </Text>
                  <Text style={styles.cardValue}>
                    {hasAvgCost ? formatMoney(estValue) : 'KES —'}
                  </Text>
                </View>
                {hasAvgCost && (
                  <View style={styles.valueBadge}>
                    <TrendingUp size={11} color={colors.green[800]} strokeWidth={2} />
                    <Text style={styles.valueBadgeText}>Est. value</Text>
                  </View>
                )}
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  categoryCount: {
    fontSize: fontSize.caption,
    color: colors.muted,
  },
  headerStats: { alignItems: 'flex-end' },
  totalKg: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    color: colors.green[800],
  },
  totalValue: {
    fontSize: fontSize.caption,
    color: colors.muted,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    padding: 0,
  },
  errorWrap: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  list: { padding: spacing[3], gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[3],
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
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  cardKg: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  cardMeta: {
    fontSize: fontSize.caption,
    color: colors.muted,
    marginTop: 2,
    flex: 1,
  },
  cardValue: {
    fontSize: fontSize.caption,
    color: colors.muted,
    marginTop: 2,
  },
  valueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  valueBadgeText: {
    fontSize: 10,
    color: colors.green[800],
    fontWeight: fontWeight.medium,
  },
});
