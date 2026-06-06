import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage, isApiError } from '../lib/api';
import { generateKey } from '../lib/idempotency';
import { getBuyers, getCategories, getInventory, createBuyer, createSale, createBuyerPayment } from '../lib/services';
import { formatDate, formatMoney, formatMethod, formatWeight, parseNumber } from '../lib/format';
import type { ReceiptData } from '../printing/receipt.types';
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
  const { accessToken, session, hasPermission } = useAuth();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();

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
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

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
  const receivedAmount = parseNumber(receivedNow);

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
        pricePerKg: parseNumber(pricePerKg),
        idempotencyKey: generateKey(),
      });

      // Record payment separately if amount received now
      if (receivedAmount > 0 && hasPermission('buyer_payment:create')) {
        await createBuyerPayment(accessToken!, {
          buyerId: buyer.id,
          amountKes: receivedAmount,
          paymentMethod: method,
          idempotencyKey: generateKey(),
        });
      }

      setSuccessMsg(
        `${Number(res.weightKg).toFixed(1)} kg · ${formatMoney(res.totalValueKes)}${receivedAmount > 0 ? ` · Received ${formatMoney(receivedAmount)}` : ''}`,
      );

      const now = new Date();
      const receipt: ReceiptData = {
        type: 'sale',
        yardName: (session?.user.tenantSlug ?? 'YardFlow').replace(/-/g, ' '),
        title: 'SALE RECEIPT',
        referenceId: `#${now.getTime().toString(36).toUpperCase().slice(-6)}`,
        dateTime: formatDate(now.toISOString()) + ' ' + now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        cashierName: session?.user.fullName ?? 'Cashier',
        partyLabel: 'Buyer',
        partyName: buyer?.label ?? '',
        lines: [
          { label: 'Category', value: category?.label ?? '' },
          { label: 'Weight', value: `${parseNumber(kg).toFixed(1)} kg` },
          { label: 'Price/kg', value: `KES ${parseNumber(pricePerKg).toFixed(0)}` },
        ],
        totalLabel: 'Total',
        totalValue: formatMoney(res.totalValueKes),
        ...(receivedAmount > 0 ? { paidLabel: 'Received now', paidValue: formatMoney(receivedAmount) } : {}),
        methodValue: receivedAmount > 0 ? formatMethod(method) : 'Deferred',
        balanceLabel: receivedAmount < parseNumber(res.totalValueKes as string) ? 'Balance due' : undefined,
        balanceValue: receivedAmount < parseNumber(res.totalValueKes as string) ? formatMoney(parseNumber(res.totalValueKes as string) - receivedAmount) : undefined,
        footer: 'Thank you · YardFlow POS',
      };
      setReceiptData(receipt);

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
    setReceiptData(null);
  };

  if (loadingData) return <LoadingView message="Loading…" />;

  if (step === 'success') {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <SuccessNote message={`Sale recorded\n${successMsg}`} />
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
          <Button label="Record another" variant="secondary" onPress={resetForm} fullWidth style={{ marginTop: spacing[3] }} />
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

      <View style={styles.kgPriceRow}>
        <View style={styles.kgField}>
          <Field
            label="Weight (kg)"
            value={kg}
            onChangeText={setKg}
            keyboardType="decimal-pad"
            placeholder="0.0"
            suffix="kg"
            returnKeyType="next"
          />
        </View>
        <View style={styles.priceField}>
          <Field
            label="Price/kg"
            value={pricePerKg}
            onChangeText={setPricePerKg}
            keyboardType="decimal-pad"
            placeholder="0"
            suffix="KES"
            returnKeyType="next"
          />
        </View>
      </View>

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
        returnKeyType="done"
      />

      {receivedAmount > 0 && <MethodPicker value={method} onChange={setMethod} />}

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
  kgPriceRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[2] },
  kgField: { flex: 1 },
  priceField: { flex: 1 },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.blue[100],
    padding: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[3],
  },
  stockLabel: { fontSize: fontSize.bodySm, color: colors.blue[700] },
  stockValue: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: colors.blue[700] },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.blue[100],
    padding: spacing[4],
    borderRadius: radius.md,
    marginBottom: spacing[4],
  },
  totalLabel: { fontSize: fontSize.body, color: colors.blue[700] },
  totalValue: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.blue[700] },
  successWrap: { flex: 1, justifyContent: 'center' },
});
