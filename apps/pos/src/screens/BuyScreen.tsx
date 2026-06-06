import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage, isApiError } from '../lib/api';
import { generateKey } from '../lib/idempotency';
import { getCategories, getSuppliers, createSupplier, createPurchase } from '../lib/services';
import { formatMoney, parseNumber } from '../lib/format';
import { useNetworkStatus } from '../lib/network';
import type { Category, PaymentMethod, Supplier } from '../types/api';
import {
  Button,
  ErrorNote,
  Field,
  LoadingView,
  MethodPicker,
  OfflineBanner,
  Screen,
  SelectSheet,
  SuccessNote,
} from '../components/ui';
import type { SelectOption } from '../components/ui';

type Step = 'form' | 'success';

export function BuyScreen() {
  const { accessToken, hasPermission } = useAuth();
  const { isConnected } = useNetworkStatus();

  const [step, setStep] = useState<Step>('form');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [supplier, setSupplier] = useState<SelectOption | null>(null);
  const [category, setCategory] = useState<SelectOption | null>(null);
  const [kg, setKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [sups, cats] = await Promise.all([getSuppliers(accessToken), getCategories(accessToken)]);
    setSuppliers(sups.filter((s) => s.isActive));
    setCategories(cats.filter((c) => c.isActive));
  }, [accessToken]);

  useEffect(() => {
    void load().finally(() => setLoadingData(false));
  }, [load]);

  const supplierOptions = useMemo<SelectOption[]>(
    () => suppliers.map((s) => ({ id: s.id, label: s.name, sublabel: s.phone ?? undefined })),
    [suppliers],
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: `Buy KES ${Number(c.defaultBuyingPriceKes).toFixed(0)}/kg`,
      })),
    [categories],
  );

  const handleCategorySelect = (opt: SelectOption) => {
    setCategory(opt);
    const cat = categories.find((c) => c.id === opt.id);
    if (cat) setPricePerKg(Number(cat.defaultBuyingPriceKes).toFixed(0));
  };

  const total = parseNumber(kg) * parseNumber(pricePerKg);

  const handleQuickCreateSupplier = async (name: string) => {
    if (!accessToken) return;
    try {
      const created = await createSupplier(accessToken, { name });
      setSuppliers((prev) => [created, ...prev]);
      setSupplier({ id: created.id, label: created.name });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSubmit = async () => {
    if (!supplier) { setError('Select a supplier'); return; }
    if (!category) { setError('Select a category'); return; }
    if (!kg || parseNumber(kg) <= 0) { setError('Enter weight in kg'); return; }
    if (!pricePerKg || parseNumber(pricePerKg) <= 0) { setError('Enter price per kg'); return; }
    if (!isConnected) { setError('No network — connect to record a purchase'); return; }
    if (!hasPermission('purchase:create')) { setError('No permission to record purchases'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await createPurchase(accessToken!, {
        supplierId: supplier.id,
        categoryId: category.id,
        weightKg: parseNumber(kg),
        pricePerKgKes: parseNumber(pricePerKg),
        paidAmountKes: parseNumber(paidNow) || 0,
        paymentMethod: method,
        idempotencyKey: generateKey(),
      });
      setSuccessMsg(
        `Recorded ${Number(res.weightKg).toFixed(1)} kg · ${formatMoney(res.totalValueKes)} · ${res.paymentStatus}`,
      );
      setStep('success');
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setError('Duplicate transaction — this purchase was already recorded.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSupplier(null);
    setCategory(null);
    setKg('');
    setPricePerKg('');
    setPaidNow('');
    setMethod('cash');
    setError(null);
    setStep('form');
  };

  if (loadingData) return <LoadingView message="Loading…" />;

  if (step === 'success') {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <SuccessNote message={`Purchase recorded\n${successMsg}`} />
          <Button label="Record another" onPress={resetForm} fullWidth style={{ marginTop: spacing[4] }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <OfflineBanner />
      <Text style={styles.pageTitle}>Record Purchase</Text>

      {error ? <ErrorNote message={error} /> : null}

      <SelectSheet
        label="Supplier"
        placeholder="Select supplier…"
        value={supplier}
        options={supplierOptions}
        onSelect={setSupplier}
        onQuickCreate={handleQuickCreateSupplier}
        quickCreateLabel="Add supplier"
        error={!supplier && error ? ' ' : null}
      />

      <SelectSheet
        label="Category"
        placeholder="Select category…"
        value={category}
        options={categoryOptions}
        onSelect={handleCategorySelect}
        error={!category && error ? ' ' : null}
      />

      <Field
        label="Weight (kg)"
        value={kg}
        onChangeText={setKg}
        keyboardType="decimal-pad"
        placeholder="0.0"
        suffix="kg"
        returnKeyType="next"
      />

      <Field
        label="Price per kg (KES)"
        value={pricePerKg}
        onChangeText={setPricePerKg}
        keyboardType="decimal-pad"
        placeholder="0"
        suffix="KES/kg"
        returnKeyType="next"
      />

      {total > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total value</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
      )}

      <Field
        label="Paid now (KES)"
        value={paidNow}
        onChangeText={setPaidNow}
        keyboardType="decimal-pad"
        placeholder="0"
        hint="Leave 0 to mark as unpaid"
        returnKeyType="done"
      />

      <MethodPicker value={method} onChange={setMethod} />

      <Button
        label="Record Purchase"
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.green[100],
    padding: spacing[4],
    borderRadius: 8,
    marginBottom: spacing[4],
  },
  totalLabel: { fontSize: fontSize.body, color: colors.green[900] },
  totalValue: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.green[900] },
  successWrap: { flex: 1, justifyContent: 'center' },
});
