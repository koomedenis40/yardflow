import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Scale,
  Wallet,
} from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import {
  getBalanceSummary,
  getBuyerPayments,
  getInventory,
  getPurchases,
  getSales,
  getSupplierPayments,
} from '../lib/services';
import { formatDate, formatMoney, formatWeight, isTodayEat } from '../lib/format';
import type { BalanceSummary, BuyerPayment, InventoryItem, Purchase, Sale, SupplierPayment } from '../types/api';
import { ErrorNote, LoadingView, OfflineBanner } from '../components/ui';
import { useNetworkStatus } from '../lib/network';

interface DashboardData {
  summary: BalanceSummary;
  inventory: InventoryItem[];
  purchases: Purchase[];
  sales: Sale[];
  supplierPayments: SupplierPayment[];
  buyerPayments: BuyerPayment[];
}

type ActivityItem = {
  kind: 'purchase' | 'sale';
  label: string;
  sub: string;
  value: string;
  date: string;
};

export function HomeScreen() {
  const { accessToken, session, hasPermission } = useAuth();
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [summary, inventory, purchases, sales, supplierPayments, buyerPayments] =
        await Promise.all([
          getBalanceSummary(accessToken),
          getInventory(accessToken),
          getPurchases(accessToken),
          getSales(accessToken),
          getSupplierPayments(accessToken),
          getBuyerPayments(accessToken),
        ]);
      setData({ summary, inventory, purchases, sales, supplierPayments, buyerPayments });
      setError(null);
    } catch {
      setError('Failed to load dashboard');
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

  if (loading) return <LoadingView message="Loading dashboard…" />;

  const totalStockKg = data?.inventory.reduce((s, r) => s + Number(r.weightKg), 0) ?? 0;
  const intakeToday = data?.purchases
    .filter((p) => isTodayEat(p.createdAt))
    .reduce((s, p) => s + Number(p.totalValueKes), 0) ?? 0;
  const salesToday = data?.sales
    .filter((s) => isTodayEat(s.createdAt))
    .reduce((s, x) => s + Number(x.totalValueKes), 0) ?? 0;

  const recentActivity: ActivityItem[] = [
    ...(data?.purchases.slice(0, 5).map((p) => ({
      kind: 'purchase' as const,
      label: p.supplier?.name ?? 'Supplier',
      sub: p.category?.name ?? '',
      value: formatMoney(p.totalValueKes),
      date: p.createdAt,
    })) ?? []),
    ...(data?.sales.slice(0, 5).map((s) => ({
      kind: 'sale' as const,
      label: s.buyer?.name ?? 'Buyer',
      sub: s.category?.name ?? '',
      value: formatMoney(s.totalValueKes),
      date: s.createdAt,
    })) ?? []),
  ]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 8);

  const yardName = (session?.user.tenantSlug ?? 'yard').replace(/-/g, ' ');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {!isConnected && <OfflineBanner />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.green[800]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {session?.user.fullName ? `Hello, ${session.user.fullName.split(' ')[0]}` : 'Good day'}
            </Text>
            <Text style={styles.yardName}>{yardName}</Text>
          </View>
        </View>

        {error ? <ErrorNote message={error} /> : null}

        {/* Stock hero */}
        <View style={styles.stockHero}>
          <Text style={styles.stockHeroLabel}>STOCK ON HAND</Text>
          <Text style={styles.stockHeroValue}>{formatWeight(totalStockKg)}</Text>
        </View>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>INTAKE TODAY</Text>
            <Text style={[styles.kpiValue, styles.kpiGreen]}>{formatMoney(intakeToday)}</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardRight]}>
            <Text style={styles.kpiLabel}>SALES TODAY</Text>
            <Text style={[styles.kpiValue, styles.kpiBlue]}>{formatMoney(salesToday)}</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>SUPPLIER OWED</Text>
            <Text style={[styles.kpiValue, styles.kpiAmber]}>
              {formatMoney(data?.summary.supplierOwedKes ?? 0)}
            </Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardRight]}>
            <Text style={styles.kpiLabel}>RECEIVABLE</Text>
            <Text style={[styles.kpiValue, styles.kpiBlue]}>
              {formatMoney(data?.summary.buyerReceivableKes ?? 0)}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionGrid}>
          {hasPermission('purchase:create') && (
            <TouchableOpacity
              style={[styles.action, styles.actionGreen]}
              onPress={() => router.push('/(tabs)/buy')}
              activeOpacity={0.8}
            >
              <ArrowDownToLine size={24} color="#fff" strokeWidth={1.75} />
              <Text style={styles.actionLabel}>Buy</Text>
              <Text style={styles.actionSub}>Record intake</Text>
            </TouchableOpacity>
          )}
          {hasPermission('sale:create') && (
            <TouchableOpacity
              style={[styles.action, styles.actionBlue]}
              onPress={() => router.push('/(tabs)/sell')}
              activeOpacity={0.8}
            >
              <ArrowUpFromLine size={24} color="#fff" strokeWidth={1.75} />
              <Text style={styles.actionLabel}>Sell</Text>
              <Text style={styles.actionSub}>Record sale</Text>
            </TouchableOpacity>
          )}
          {hasPermission('supplier_payment:create') && (
            <TouchableOpacity
              style={[styles.action, styles.actionNeutral]}
              onPress={() => router.push('/(tabs)/pay')}
              activeOpacity={0.8}
            >
              <Wallet size={24} color={colors.text} strokeWidth={1.75} />
              <Text style={[styles.actionLabel, styles.actionLabelDark]}>Pay</Text>
              <Text style={[styles.actionSub, styles.actionSubDark]}>Settle balance</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.action, styles.actionNeutral]}
            onPress={() => router.push('/stock')}
            activeOpacity={0.8}
          >
            <Scale size={24} color={colors.text} strokeWidth={1.75} />
            <Text style={[styles.actionLabel, styles.actionLabelDark]}>Stock</Text>
            <Text style={[styles.actionSub, styles.actionSubDark]}>View inventory</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        <View style={styles.activityCard}>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyText}>No transactions yet today</Text>
              <Text style={styles.emptySubText}>Pull down to refresh</Text>
            </View>
          ) : (
            recentActivity.map((item, i) => (
              <View
                key={i}
                style={[
                  styles.activityRow,
                  i < recentActivity.length - 1 && styles.activityRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.activityDot,
                    item.kind === 'purchase' ? styles.dotGreen : styles.dotBlue,
                  ]}
                />
                <View style={styles.activityContent}>
                  <Text style={styles.activityLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.activitySub} numberOfLines={1}>
                    {item.sub} · {formatDate(item.date)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.activityValue,
                    item.kind === 'purchase' ? styles.activityValueGreen : styles.activityValueBlue,
                  ]}
                >
                  {item.value}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing[4], paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[5],
  },
  greeting: { fontSize: fontSize.caption, color: colors.muted, marginBottom: 2 },
  yardName: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textTransform: 'capitalize',
  },

  stockHero: {
    backgroundColor: colors.green[900],
    borderRadius: radius.md,
    padding: spacing[5],
    marginBottom: spacing[3],
    alignItems: 'center',
  },
  stockHeroLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  stockHeroValue: {
    fontSize: 36,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },

  kpiRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    elevation: 1,
  },
  kpiCardRight: {},
  kpiLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  kpiValue: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold },
  kpiGreen: { color: colors.green[800] },
  kpiBlue: { color: colors.blue[700] },
  kpiAmber: { color: colors.amber.text },

  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: spacing[3],
    marginTop: spacing[2],
  },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginBottom: spacing[5] },
  action: {
    width: '47%',
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    minHeight: 96,
    gap: 4,
  },
  actionGreen: { backgroundColor: colors.green[800] },
  actionBlue: { backgroundColor: colors.blue[700] },
  actionNeutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  actionLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: '#fff',
    marginTop: 4,
  },
  actionLabelDark: { color: colors.text },
  actionSub: { fontSize: fontSize.caption, color: 'rgba(255,255,255,0.7)' },
  actionSubDark: { color: colors.muted },

  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    elevation: 1,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    gap: 12,
  },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  activityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotGreen: { backgroundColor: colors.green[800] },
  dotBlue: { backgroundColor: colors.blue[700] },
  activityContent: { flex: 1, minWidth: 0 },
  activityLabel: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  activitySub: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  activityValue: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, flexShrink: 0 },
  activityValueGreen: { color: colors.green[800] },
  activityValueBlue: { color: colors.blue[700] },

  emptyActivity: { padding: spacing[6], alignItems: 'center' },
  emptyText: { fontSize: fontSize.body, color: colors.muted },
  emptySubText: { fontSize: fontSize.caption, color: colors.neutral[400] ?? colors.muted, marginTop: 4 },
});
