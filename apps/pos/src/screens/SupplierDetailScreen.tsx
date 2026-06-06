import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownToLine, ChevronLeft, ChevronRight, Wallet } from 'lucide-react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage } from '../lib/api';
import { getSupplierDetail } from '../lib/services';
import { formatDate, formatMoney, formatMethod } from '../lib/format';
import { buildSupplierPaymentReceiptFromEntry } from '../printing/receipt.builder';
import type { SupplierDetail } from '../types/api';
import { ErrorNote, LoadingView } from '../components/ui';

export function SupplierDetailScreen({ id }: { id: string }) {
  const { accessToken, session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setError(null);
      const data = await getSupplierDetail(accessToken, id);
      setSupplier(data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [accessToken, id]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <LoadingView message="Loading supplier…" />;
  if (error || !supplier) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ErrorNote message={error ?? 'Supplier not found'} />
      </View>
    );
  }

  const hasBalance = supplier.balanceKes > 0;
  const hasCredit = supplier.creditBalanceKes > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <ChevronLeft size={20} color={colors.text} strokeWidth={1.75} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{supplier.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{supplier.name}</Text>
            <Text style={styles.phone}>{supplier.phone ?? 'No phone'}</Text>
          </View>
        </View>

        {/* Balance cards */}
        <View style={styles.balanceRow}>
          <View style={[styles.balanceCard, hasBalance && styles.balanceCardAmber]}>
            <Text style={styles.balanceLabel}>OWED TO SUPPLIER</Text>
            <Text style={[styles.balanceValue, hasBalance ? styles.balanceAmber : styles.balanceMuted]}>
              {formatMoney(supplier.balanceKes)}
            </Text>
          </View>
          <View style={[styles.balanceCard, hasCredit && styles.balanceCardGreen]}>
            <Text style={styles.balanceLabel}>CREDIT</Text>
            <Text style={[styles.balanceValue, hasCredit ? styles.balanceGreen : styles.balanceMuted]}>
              {formatMoney(supplier.creditBalanceKes)}
            </Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGreen]}
            onPress={() => router.push('/(tabs)/buy')}
            activeOpacity={0.8}
          >
            <ArrowDownToLine size={18} color="#fff" strokeWidth={1.75} />
            <Text style={styles.actionBtnLabel}>New Purchase</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnNeutral]}
            onPress={() => router.push('/(tabs)/pay')}
            activeOpacity={0.8}
          >
            <Wallet size={18} color={colors.text} strokeWidth={1.75} />
            <Text style={[styles.actionBtnLabel, styles.actionBtnLabelDark]}>Pay Supplier</Text>
          </TouchableOpacity>
        </View>

        {/* Outstanding purchases */}
        <Text style={styles.sectionTitle}>OUTSTANDING PURCHASES</Text>
        <View style={styles.card}>
          {supplier.unpaidPurchases.length === 0 ? (
            <Text style={styles.emptyText}>Nothing outstanding</Text>
          ) : (
            supplier.unpaidPurchases.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.row, i < supplier.unpaidPurchases.length - 1 && styles.rowBorder]}
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert(
                    'Receipt unavailable',
                    'Full receipt details (weight, price, payment method) are not returned by the outstanding purchases endpoint. Open the purchase in transaction history to reprint.',
                    [{ text: 'OK' }],
                  )
                }
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowPrimary}>
                    {p.category?.name ?? 'Purchase'}
                  </Text>
                  <Text style={styles.rowMeta}>{formatDate(p.createdAt)}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmber}>{formatMoney(p.remainingKes)} left</Text>
                  <Text style={styles.rowMuted}>{formatMoney(p.totalValueKes)} total</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent payments */}
        <Text style={styles.sectionTitle}>RECENT PAYMENTS</Text>
        <View style={styles.card}>
          {supplier.recentPayments.length === 0 ? (
            <Text style={styles.emptyText}>No payments yet</Text>
          ) : (
            supplier.recentPayments.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.row, i < supplier.recentPayments.length - 1 && styles.rowBorder]}
                activeOpacity={0.7}
                onPress={() => {
                  const receipt = buildSupplierPaymentReceiptFromEntry(
                    p,
                    supplier.name,
                    session?.user.fullName ?? 'Cashier',
                    session?.user.tenantSlug,
                  );
                  router.push({ pathname: '/receipt-preview', params: { receipt: JSON.stringify(receipt) } });
                }}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowPrimary}>{formatMethod(p.paymentMethod)}</Text>
                  <Text style={styles.rowMeta}>{formatDate(p.createdAt)}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowGreen}>{formatMoney(p.amountKes)}</Text>
                  <ChevronRight size={14} color={colors.muted} strokeWidth={1.75} />
                </View>
              </TouchableOpacity>
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
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  backBtn: { padding: 4 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.amber.bg ?? colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.amber.text ?? colors.text },
  headerInfo: { flex: 1 },
  name: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold, color: colors.text },
  phone: { fontSize: fontSize.bodySm, color: colors.muted, marginTop: 2 },

  balanceRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  balanceCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    elevation: 1,
  },
  balanceCardAmber: { borderLeftWidth: 3, borderLeftColor: colors.amber.text },
  balanceCardGreen: { borderLeftWidth: 3, borderLeftColor: colors.green[800] },
  balanceLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  balanceValue: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold },
  balanceAmber: { color: colors.amber.text },
  balanceGreen: { color: colors.green[800] },
  balanceMuted: { color: colors.muted },

  actionRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  actionBtnGreen: { backgroundColor: colors.green[800] },
  actionBtnNeutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  actionBtnLabel: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: '#fff' },
  actionBtnLabelDark: { color: colors.text },

  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    marginTop: spacing[2],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    elevation: 1,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  rowPrimary: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  rowMeta: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  rowMuted: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  rowAmber: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: colors.amber.text },
  rowGreen: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.green[800] },
  emptyText: {
    padding: spacing[4],
    fontSize: fontSize.bodySm,
    color: colors.muted,
    textAlign: 'center',
  },
});
