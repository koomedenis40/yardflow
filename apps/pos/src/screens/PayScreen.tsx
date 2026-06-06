import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage } from '../lib/api';
import { generateKey } from '../lib/idempotency';
import {
  getBuyers, getBuyer, getSuppliers, getSupplier,
  createSupplierPayment, createBuyerPayment,
} from '../lib/services';
import { formatDate, formatMoney, formatMethod, parseNumber } from '../lib/format';
import type { ReceiptData } from '../printing/receipt.types';
import { useNetworkStatus } from '../lib/network';
import type { Buyer, PaymentMethod, Supplier, SupplierPayment, BuyerPayment } from '../types/api';
import {
  Button, ErrorNote, Field, LoadingView, MethodPicker,
  OfflineBanner, Screen, SelectSheet, SuccessNote,
} from '../components/ui';
import type { SelectOption } from '../components/ui';

type Mode = 'supplier' | 'buyer';
type Step = 'form' | 'success';

export function PayScreen() {
  const { accessToken, session, hasPermission } = useAuth();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('supplier');
  const [step, setStep] = useState<Step>('form');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedParty, setSelectedParty] = useState<SelectOption | null>(null);
  const [partyDetail, setPartyDetail] = useState<Supplier | Buyer | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SupplierPayment | BuyerPayment | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [sups, buys] = await Promise.all([getSuppliers(accessToken), getBuyers(accessToken)]);
    setSuppliers(sups.filter((s) => s.isActive));
    setBuyers(buys.filter((b) => b.isActive));
  }, [accessToken]);

  useEffect(() => {
    void load().finally(() => setLoadingData(false));
  }, [load]);

  const supplierOptions = useMemo<SelectOption[]>(
    () =>
      suppliers
        .filter((s) => Number(s.balanceKes) > 0 || Number(s.creditBalanceKes) > 0)
        .map((s) => ({
          id: s.id,
          label: s.name,
          sublabel: `Owed: ${formatMoney(s.balanceKes)}`,
        })),
    [suppliers],
  );

  const buyerOptions = useMemo<SelectOption[]>(
    () =>
      buyers
        .filter((b) => Number(b.balanceKes) > 0)
        .map((b) => ({
          id: b.id,
          label: b.name,
          sublabel: `Receivable: ${formatMoney(b.balanceKes)}`,
        })),
    [buyers],
  );

  const handlePartySelect = async (opt: SelectOption) => {
    setSelectedParty(opt);
    setPartyDetail(null);
    setError(null);
    if (!accessToken) return;
    try {
      if (mode === 'supplier') {
        setPartyDetail(await getSupplier(accessToken, opt.id));
      } else {
        setPartyDetail(await getBuyer(accessToken, opt.id));
      }
    } catch {
      setError('Failed to load party details');
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedParty(null);
    setPartyDetail(null);
    setAmount('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedParty) { setError('Select a party'); return; }
    if (!amount || parseNumber(amount) <= 0) { setError('Enter payment amount'); return; }
    if (!isConnected) { setError('No network — connect to record a payment'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      const baseReceipt = {
        yardName: (session?.user.tenantSlug ?? 'YardFlow').replace(/-/g, ' '),
        referenceId: `#${now.getTime().toString(36).toUpperCase().slice(-6)}`,
        dateTime: formatDate(now.toISOString()) + ' ' + now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        cashierName: session?.user.fullName ?? 'Cashier',
        lines: [] as Array<{ label: string; value: string }>,
        methodValue: formatMethod(method),
        footer: 'Thank you · YardFlow POS',
      };

      if (mode === 'supplier') {
        if (!hasPermission('supplier_payment:create')) { setError('No permission'); return; }
        const res = await createSupplierPayment(accessToken!, {
          supplierId: selectedParty.id,
          amountKes: parseNumber(amount),
          paymentMethod: method,
          idempotencyKey: generateKey(),
        });
        setSuccessResult(res);
        setReceiptData({
          ...baseReceipt,
          type: 'supplier_payment',
          title: 'SUPPLIER PAYMENT',
          partyLabel: 'Supplier',
          partyName: selectedParty.label,
          totalLabel: 'Amount Paid',
          totalValue: formatMoney(res.amountKes),
        });
      } else {
        if (!hasPermission('buyer_payment:create')) { setError('No permission'); return; }
        const res = await createBuyerPayment(accessToken!, {
          buyerId: selectedParty.id,
          amountKes: parseNumber(amount),
          paymentMethod: method,
          idempotencyKey: generateKey(),
        });
        setSuccessResult(res);
        setReceiptData({
          ...baseReceipt,
          type: 'buyer_payment',
          title: 'PAYMENT RECEIVED',
          partyLabel: 'Buyer',
          partyName: selectedParty.label,
          totalLabel: 'Amount Received',
          totalValue: formatMoney(res.amountKes),
        });
      }
      setStep('success');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSelectedParty(null);
    setPartyDetail(null);
    setAmount('');
    setMethod('cash');
    setError(null);
    setStep('form');
    setSuccessResult(null);
    setReceiptData(null);
    void load();
  };

  if (loadingData) return <LoadingView message="Loading…" />;

  if (step === 'success' && successResult) {
    const allocCount = successResult.allocations?.length ?? 0;
    return (
      <Screen>
        <View style={styles.successWrap}>
          <SuccessNote
            message={`Payment recorded\n${formatMoney(successResult.amountKes)}`}
          />
          {allocCount > 0 && (
            <View style={styles.allocNote}>
              <Text style={styles.allocText}>
                {allocCount} balance allocation{allocCount !== 1 ? 's' : ''} applied automatically
              </Text>
            </View>
          )}
          {receiptData && (
            <Button
              label="View Receipt"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/receipt-preview',
                  params: { receipt: JSON.stringify(receiptData) },
                })
              }
              fullWidth
              style={{ marginTop: spacing[3] }}
            />
          )}
          <Button
            label="New payment"
            variant="secondary"
            onPress={reset}
            fullWidth
            style={{ marginTop: spacing[3] }}
          />
        </View>
      </Screen>
    );
  }

  const supplierDetail = mode === 'supplier' && partyDetail ? (partyDetail as Supplier) : null;
  const buyerDetail = mode === 'buyer' && partyDetail ? (partyDetail as Buyer) : null;

  return (
    <Screen>
      <OfflineBanner />
      <Text style={styles.pageTitle}>Payments</Text>

      {/* Mode toggle */}
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'supplier' && styles.toggleActive]}
          onPress={() => handleModeChange('supplier')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleLabel, mode === 'supplier' && styles.toggleLabelActive]}>
            Pay Supplier
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'buyer' && styles.toggleActive]}
          onPress={() => handleModeChange('buyer')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleLabel, mode === 'buyer' && styles.toggleLabelActive]}>
            Receive from Buyer
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <ErrorNote message={error} /> : null}

      {mode === 'supplier' ? (
        <SelectSheet
          label="Supplier"
          placeholder="Select supplier…"
          value={selectedParty}
          options={supplierOptions}
          onSelect={handlePartySelect}
        />
      ) : (
        <SelectSheet
          label="Buyer"
          placeholder="Select buyer…"
          value={selectedParty}
          options={buyerOptions}
          onSelect={handlePartySelect}
        />
      )}

      {/* Balance context */}
      {supplierDetail && (
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Owed to supplier</Text>
            <Text style={[styles.balanceValue, styles.balanceAmber]}>
              {formatMoney(supplierDetail.balanceKes)}
            </Text>
          </View>
          {Number(supplierDetail.creditBalanceKes) > 0 && (
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Credit balance</Text>
              <Text style={[styles.balanceValue, styles.balanceGreen]}>
                {formatMoney(supplierDetail.creditBalanceKes)}
              </Text>
            </View>
          )}
        </View>
      )}

      {buyerDetail && (
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Receivable from buyer</Text>
            <Text style={[styles.balanceValue, styles.balanceBlue]}>
              {formatMoney((buyerDetail as Buyer).balanceKes)}
            </Text>
          </View>
        </View>
      )}

      <Field
        label={mode === 'supplier' ? 'Payment amount (KES)' : 'Amount received (KES)'}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        returnKeyType="done"
      />

      <MethodPicker value={method} onChange={setMethod} />

      <Button
        label={mode === 'supplier' ? 'Pay Supplier' : 'Receive Payment'}
        onPress={handleSubmit}
        loading={submitting}
        fullWidth
        style={{ marginTop: spacing[2] }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing[4],
    marginTop: spacing[2],
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: radius.sm,
    padding: 4,
    marginBottom: spacing[4],
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.surface, elevation: 2 },
  toggleLabel: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.medium,
    color: colors.muted,
  },
  toggleLabelActive: { color: colors.text },
  balanceRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  balanceItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    elevation: 1,
  },
  balanceLabel: {
    fontSize: fontSize.caption,
    color: colors.muted,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  balanceValue: { fontSize: fontSize.h3, fontWeight: fontWeight.semibold },
  balanceAmber: { color: colors.amber.text },
  balanceGreen: { color: colors.green[800] },
  balanceBlue: { color: colors.blue[700] },
  successWrap: { flex: 1, justifyContent: 'center' },
  allocNote: {
    marginTop: spacing[3],
    backgroundColor: colors.green[100],
    borderRadius: radius.sm,
    padding: spacing[3],
  },
  allocText: { fontSize: fontSize.bodySm, color: colors.green[900], textAlign: 'center' },
});
