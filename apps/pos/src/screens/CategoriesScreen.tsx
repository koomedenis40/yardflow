import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getCategories } from '../lib/services';
import { formatMoney } from '../lib/format';
import type { Category } from '../types/api';
import { EmptyState, ErrorNote, LoadingView, OfflineBanner } from '../components/ui';

export function CategoriesScreen() {
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const cats = await getCategories(accessToken);
      setCategories(cats);
      setError(null);
    } catch {
      setError('Failed to load categories');
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

  if (loading) return <LoadingView message="Loading categories…" />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />

      {error ? <View style={styles.errorWrap}><ErrorNote message={error} /></View> : null}

      <FlatList
        data={categories.filter((c) => c.isActive)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green[800]} />
        }
        ListEmptyComponent={<EmptyState message="No categories" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.prices}>
              <View>
                <Text style={styles.priceLabel}>Buy</Text>
                <Text style={styles.priceValue}>{formatMoney(item.defaultBuyingPriceKes)}/kg</Text>
              </View>
              <View style={styles.divider} />
              <View>
                <Text style={styles.priceLabel}>Sell</Text>
                <Text style={[styles.priceValue, styles.sellPrice]}>
                  {formatMoney(item.defaultSellingPriceKes)}/kg
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  errorWrap: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  list: { padding: spacing[4], paddingBottom: 24 },
  row: { gap: 8, marginBottom: 8 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    elevation: 1,
  },
  name: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 8 },
  prices: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceLabel: { fontSize: fontSize.caption, color: colors.muted, marginBottom: 2 },
  priceValue: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, color: colors.text },
  sellPrice: { color: colors.blue[700] },
  divider: { width: 1, height: 24, backgroundColor: colors.border },
});
