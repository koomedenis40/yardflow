import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage } from '../lib/api';
import { generateKey } from '../lib/idempotency';
import {
  getBuyers,
  getBuyer,
  getSuppliers,
  getSupplier,
  createSupplierPayment,
  createBuyerPayment,
} from '../lib/services';
import { formatMoney, parseNumber } from '../lib/format';
import { useNetworkStatus } from '../lib/network';
import type { Buyer, PaymentMethod, Supplier, SupplierPayment, BuyerPayment } from '../types/api';
import {
  Button,
  ErrorNote,
  Field,
  Kpi,
  LoadingView,
  MethodPicker,
  OfflineBanner,
  Screen,
  SelectSheet,
  SuccessNote,
} from '../components/ui';
import type { SelectOption } from '../components/ui';

type Mode = 'supplier' | 'buyer';
type Step = 'form' | 'success';

export function PayScreen() {
  const { accessToken, hasPermission } = useAuth();
  const { isConnected } = useNetworkStatus();

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
        const detail = await getSupplier(accessToken, opt.id);
        setPartyDetail(detail);
      } else {
        const detail = await getBuyer(accessToken, opt.id);
        setPartyDetail(detail);
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
      if (mode === 'supplier') {
        if (!hasPermission('supplier_payment:create')) { setError('No permission'); return; }
        const res = await createSupplierPayment(accessToken!, {
          supplierId: selectedParty.id,
          amountKes: parseNumber(amount),
          paymentMethod: method,
          idempotencyKey: generateKey(),
        });
        setSuccessResult(res);
      } else {
        if (!hasPermission('buyer_payment:create')) { setError('No permission'); return; }
        const res = await createBuyerPayment(accessToken!, {
          buyerId: selectedParty.id,
          amountKes: parseNumber(amount),
          paymentMethod: method,
          idempotencyKey: generateKey(),
        });
        setSuccessResult(res);
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
    void load();
  };

  if (loadingData) return <LoadingView message="Loading…" />;

  if (step === 'success' && successResult) {
    const allocCount = successResult.allocations?.length ?? 0;
    return (
      <Screen>
        <View style={styles.successWrap}>
          <SuccessNote
            message={`Payment recorded · ${formatMoney(successResult.amountKes)}\n${allocCount} allocation${allocCount !== 1 ? 's' : ''} applied`}
          />
          <Button label="New payment" onPress={reset} fullWidth style={{ marginTop: spacing[4] }} />
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
        >
          <Text style={[styles.toggleLabel, mode === 'supplier' && styles.toggleLabelActive]}>
            Pay Supplier
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'buyer' && styles.toggleActive]}
          onPress={() => handleModeChange('buyer')}
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

      {supplierDetail && (
        <View style={styles.balanceGrid}>
          <View style={styles.balanceHalf}>
            <Kpi label="Owed" value={formatMoney(supplierDetail.balanceKes)} tone="amber" />
          </View>
          <View style={styles.balanceHalf}>
            <Kpi label="Credit" value={formatMoney(supplierDetail.creditBalanceKes)} tone="green" />
          </View>
        </View>
      )}

      {buyerDetail && (
        <View style={styles.balanceGrid}>
          <View style={styles.balanceFull}>
            <Kpi label="Receivable" value={formatMoney((buyerDetail as Buyer).balanceKes)} tone="blue" />
          </View>
        </View>
      )}

      <Field
        label={mode === 'supplier' ? 'Payment amount (KES)' : 'Amount received (KES)'}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
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
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.surface, elevation: 2 },
  toggleLabel: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: colors.muted },
  toggleLabelActive: { color: colors.text },
  balanceGrid: { flexDirection: 'row', gap: 8, marginBottom: spacing[4] },
  balanceHalf: { flex: 1 },
  balanceFull: { flex: 1 },
  successWrap: { flex: 1, justifyContent: 'center' },
});
