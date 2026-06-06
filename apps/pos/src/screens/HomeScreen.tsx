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
  Banknote,
  Package,
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
import { ErrorNote, Kpi, LoadingView, OfflineBanner } from '../components/ui';
import { useNetworkStatus } from '../lib/network';

interface DashboardData {
  summary: BalanceSummary;
  inventory: InventoryItem[];
  purchases: Purchase[];
  sales: Sale[];
  supplierPayments: SupplierPayment[];
  buyerPayments: BuyerPayment[];
}

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

  const totalStock = data?.inventory.reduce((s, r) => s + Number(r.weightKg), 0) ?? 0;
  const intakeToday = data?.purchases.filter((p) => isTodayEat(p.createdAt)).reduce((s, p) => s + Number(p.totalValueKes), 0) ?? 0;
  const salesToday = data?.sales.filter((s) => isTodayEat(s.createdAt)).reduce((s, x) => s + Number(x.totalValueKes), 0) ?? 0;

  const recentActivity = [
    ...(data?.purchases.slice(0, 4).map((p) => ({
      kind: 'purchase' as const,
      label: p.supplier?.name ?? 'Supplier',
      value: formatMoney(p.totalValueKes),
      date: p.createdAt,
    })) ?? []),
    ...(data?.sales.slice(0, 4).map((s) => ({
      kind: 'sale' as const,
      label: s.buyer?.name ?? 'Buyer',
      value: formatMoney(s.totalValueKes),
      date: s.createdAt,
    })) ?? []),
  ]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 8);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green[800]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day</Text>
            <Text style={styles.yardName}>{session?.user.tenantSlug ?? 'Yard'}</Text>
          </View>
          <Package size={28} color={colors.green[800]} strokeWidth={1.75} />
        </View>

        {error ? <ErrorNote message={error} /> : null}

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiFull}>
            <Kpi label="Stock on hand" value={formatWeight(totalStock)} tone="featured" />
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpiHalf}>
              <Kpi label="Intake today" value={formatMoney(intakeToday)} tone="green" />
            </View>
            <View style={styles.kpiHalf}>
              <Kpi label="Sales today" value={formatMoney(salesToday)} tone="blue" />
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpiHalf}>
              <Kpi
                label="Supplier owed"
                value={formatMoney(data?.summary.supplierOwedKes ?? 0)}
                tone="amber"
              />
            </View>
            <View style={styles.kpiHalf}>
              <Kpi
                label="Receivable"
                value={formatMoney(data?.summary.buyerReceivableKes ?? 0)}
                tone="blue"
              />
            </View>
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
              <ArrowDownToLine size={22} color="#fff" strokeWidth={1.75} />
              <Text style={styles.actionLabel}>Buy</Text>
            </TouchableOpacity>
          )}
          {hasPermission('sale:create') && (
            <TouchableOpacity
              style={[styles.action, styles.actionBlue]}
              onPress={() => router.push('/(tabs)/sell')}
              activeOpacity={0.8}
            >
              <ArrowUpFromLine size={22} color="#fff" strokeWidth={1.75} />
              <Text style={styles.actionLabel}>Sell</Text>
            </TouchableOpacity>
          )}
          {hasPermission('supplier_payment:create') && (
            <TouchableOpacity
              style={[styles.action, styles.actionNeutral]}
              onPress={() => router.push('/(tabs)/pay')}
              activeOpacity={0.8}
            >
              <Wallet size={22} color={colors.text} strokeWidth={1.75} />
              <Text style={[styles.actionLabel, styles.actionLabelDark]}>Pay</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.action, styles.actionNeutral]}
            onPress={() => router.push('/stock')}
            activeOpacity={0.8}
          >
            <Scale size={22} color={colors.text} strokeWidth={1.75} />
            <Text style={[styles.actionLabel, styles.actionLabelDark]}>Stock</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        <View style={styles.activityCard}>
          {recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No transactions recorded yet</Text>
          ) : (
            recentActivity.map((item, i) => (
              <View key={i} style={[styles.activityRow, i < recentActivity.length - 1 && styles.activityRowBorder]}>
                <View style={[styles.activityDot, item.kind === 'purchase' ? styles.dotGreen : styles.dotBlue]} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.activityDate}>{formatDate(item.date)}</Text>
                </View>
                <Text style={styles.activityValue}>{item.value}</Text>
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
  scroll: { padding: spacing[4], paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  greeting: { fontSize: fontSize.caption, color: colors.muted, marginBottom: 2 },
  yardName: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },

  kpiGrid: { gap: 8, marginBottom: spacing[6] },
  kpiFull: { flex: 1 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiHalf: { flex: 1 },

  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  actionGrid: { flexDirection: 'row', gap: 8, marginBottom: spacing[6] },
  action: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 72,
  },
  actionGreen: { backgroundColor: colors.green[800] },
  actionBlue: { backgroundColor: colors.blue[700] },
  actionNeutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  actionLabel: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: '#fff' },
  actionLabelDark: { color: colors.text },

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
    paddingVertical: 12,
    gap: 10,
  },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: colors.green[800] },
  dotBlue: { backgroundColor: colors.blue[700] },
  activityContent: { flex: 1 },
  activityLabel: { fontSize: fontSize.body, color: colors.text },
  activityDate: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  activityValue: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  emptyText: { padding: spacing[4], color: colors.muted, textAlign: 'center' },
});
