import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage, isApiError } from '../lib/api';
import { generateKey } from '../lib/idempotency';
import { getBuyers, getCategories, getInventory, createBuyer, createSale } from '../lib/services';
import { formatMoney, formatWeight, parseNumber } from '../lib/format';
import { useNetworkStatus } from '../lib/network';
import type { Buyer, Category, InventoryItem, PaymentMethod } from '../types/api';
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

export function SellScreen() {
  const { accessToken, hasPermission } = useAuth();
  const { isConnected } = useNetworkStatus();

  const [step, setStep] = useState<Step>('form');
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [buyer, setBuyer] = useState<SelectOption | null>(null);
  const [category, setCategory] = useState<SelectOption | null>(null);
  const [kg, setKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [receivedNow, setReceivedNow] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [b, c, inv] = await Promise.all([
      getBuyers(accessToken),
      getCategories(accessToken),
      getInventory(accessToken),
    ]);
    setBuyers(b.filter((x) => x.isActive));
    setCategories(c.filter((x) => x.isActive));
    setInventory(inv);
  }, [accessToken]);

  useEffect(() => {
    void load().finally(() => setLoadingData(false));
  }, [load]);

  const buyerOptions = useMemo<SelectOption[]>(
    () => buyers.map((b) => ({ id: b.id, label: b.name, sublabel: b.phone ?? undefined })),
    [buyers],
  );

  const stockByCategory = useMemo(
    () => Object.fromEntries(inventory.map((i) => [i.categoryId, Number(i.weightKg)])),
    [inventory],
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: `${formatWeight(stockByCategory[c.id] ?? 0)} on hand`,
      })),
    [categories, stockByCategory],
  );

  const selectedStock = category ? (stockByCategory[category.id] ?? 0) : null;

  const handleCategorySelect = (opt: SelectOption) => {
    setCategory(opt);
    const cat = categories.find((c) => c.id === opt.id);
    if (cat) setPricePerKg(Number(cat.defaultSellingPriceKes).toFixed(0));
  };

  const total = parseNumber(kg) * parseNumber(pricePerKg);

  const handleQuickCreateBuyer = async (name: string) => {
    if (!accessToken) return;
    try {
      const created = await createBuyer(accessToken, { name });
      setBuyers((prev) => [created, ...prev]);
      setBuyer({ id: created.id, label: created.name });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSubmit = async () => {
    if (!buyer) { setError('Select a buyer'); return; }
    if (!category) { setError('Select a category'); return; }
    if (!kg || parseNumber(kg) <= 0) { setError('Enter weight in kg'); return; }
    if (!pricePerKg || parseNumber(pricePerKg) <= 0) { setError('Enter price per kg'); return; }
    if (!isConnected) { setError('No network — connect to record a sale'); return; }
    if (!hasPermission('sale:create')) { setError('No permission to record sales'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await createSale(accessToken!, {
        buyerId: buyer.id,
        categoryId: category.id,
        weightKg: parseNumber(kg),
        pricePerKgKes: parseNumber(pricePerKg),
        paidAmountKes: parseNumber(receivedNow) || 0,
        paymentMethod: method,
        idempotencyKey: generateKey(),
      });
      setSuccessMsg(
        `Sold ${Number(res.weightKg).toFixed(1)} kg · ${formatMoney(res.totalValueKes)} · ${res.paymentStatus}`,
      );
      setStep('success');
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setError('Oversell blocked — not enough stock in this category.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setBuyer(null);
    setCategory(null);
    setKg('');
    setPricePerKg('');
    setReceivedNow('');
    setMethod('cash');
    setError(null);
    setStep('form');
  };

  if (loadingData) return <LoadingView message="Loading…" />;

  if (step === 'success') {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <SuccessNote message={`Sale recorded\n${successMsg}`} />
          <Button label="Record another" onPress={resetForm} fullWidth style={{ marginTop: spacing[4] }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <OfflineBanner />
      <Text style={styles.pageTitle}>Record Sale</Text>

      {error ? <ErrorNote message={error} /> : null}

      <SelectSheet
        label="Buyer"
        placeholder="Select buyer…"
        value={buyer}
        options={buyerOptions}
        onSelect={setBuyer}
        onQuickCreate={handleQuickCreateBuyer}
        quickCreateLabel="Add buyer"
      />

      <SelectSheet
        label="Category"
        placeholder="Select category…"
        value={category}
        options={categoryOptions}
        onSelect={handleCategorySelect}
      />

      {selectedStock !== null && (
        <View style={styles.stockRow}>
          <Text style={styles.stockLabel}>Available stock</Text>
          <Text style={styles.stockValue}>{formatWeight(selectedStock)}</Text>
        </View>
      )}

      <Field
        label="Weight (kg)"
        value={kg}
        onChangeText={setKg}
        keyboardType="decimal-pad"
        placeholder="0.0"
        suffix="kg"
      />

      <Field
        label="Price per kg (KES)"
        value={pricePerKg}
        onChangeText={setPricePerKg}
        keyboardType="decimal-pad"
        placeholder="0"
        suffix="KES/kg"
      />

      {total > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total value</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
      )}

      <Field
        label="Received now (KES)"
        value={receivedNow}
        onChangeText={setReceivedNow}
        keyboardType="decimal-pad"
        placeholder="0"
        hint="Leave 0 to record as receivable"
      />

      <MethodPicker value={method} onChange={setMethod} />

      <Button
        label="Record Sale"
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
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.blue[100],
    padding: spacing[3],
    borderRadius: 8,
    marginBottom: spacing[4],
  },
  stockLabel: { fontSize: fontSize.bodySm, color: colors.blue[700] },
  stockValue: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: colors.blue[700] },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.blue[100],
    padding: spacing[4],
    borderRadius: 8,
    marginBottom: spacing[4],
  },
  totalLabel: { fontSize: fontSize.body, color: colors.blue[700] },
  totalValue: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.blue[700] },
  successWrap: { flex: 1, justifyContent: 'center' },
});
