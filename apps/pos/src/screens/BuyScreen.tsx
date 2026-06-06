import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@yardflow/theme';
import { useAuth } from '../lib/auth-context';
import { getErrorMessage, isApiError } from '../lib/api';
import { generateKey } from '../lib/idempotency';
import { getCategories, getSuppliers, createSupplier, createPurchase, createSupplierPayment } from '../lib/services';
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

interface LineItem {
  id: string;
  categoryId: string;
  categoryName: string;
  weightKg: number;
  pricePerKg: number;
  total: number;
}

type Step = 'form' | 'success';

export function BuyScreen() {
  const { accessToken, hasPermission } = useAuth();
  const { isConnected } = useNetworkStatus();

  const [step, setStep] = useState<Step>('form');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Session state
  const [supplier, setSupplier] = useState<SelectOption | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);

  // Inline add-item fields
  const [addCategory, setAddCategory] = useState<SelectOption | null>(null);
  const [addKg, setAddKg] = useState('');
  const [addPrice, setAddPrice] = useState('');

  // Payment fields
  const [paidNow, setPaidNow] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLines, setSuccessLines] = useState<string[]>([]);

  const itemIdRef = useRef(0);

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
        sublabel: `KES ${Number(c.defaultBuyingPriceKes).toFixed(0)}/kg`,
      })),
    [categories],
  );

  const handleAddCategorySelect = (opt: SelectOption) => {
    setAddCategory(opt);
    const cat = categories.find((c) => c.id === opt.id);
    if (cat) setAddPrice(Number(cat.defaultBuyingPriceKes).toFixed(0));
  };

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

  const addItem = () => {
    if (!addCategory) { setError('Select a category'); return; }
    const kg = parseNumber(addKg);
    const price = parseNumber(addPrice);
    if (kg <= 0) { setError('Enter weight in kg'); return; }
    if (price <= 0) { setError('Enter price per kg'); return; }
    setError(null);
    itemIdRef.current += 1;
    setItems((prev) => [
      ...prev,
      {
        id: String(itemIdRef.current),
        categoryId: addCategory.id,
        categoryName: addCategory.label,
        weightKg: kg,
        pricePerKg: price,
        total: kg * price,
      },
    ]);
    setAddCategory(null);
    setAddKg('');
    setAddPrice('');
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const sessionTotal = items.reduce((s, i) => s + i.total, 0);
  const paidAmount = parseNumber(paidNow);

  const handleSubmit = async () => {
    if (!supplier) { setError('Select a supplier'); return; }
    if (items.length === 0) { setError('Add at least one item'); return; }
    if (!isConnected) { setError('No network — connect to record a purchase'); return; }
    if (!hasPermission('purchase:create')) { setError('No permission to record purchases'); return; }
    if (paidAmount > 0 && !hasPermission('supplier_payment:create')) {
      setError('No permission to record payments'); return;
    }

    setSubmitting(true);
    setError(null);
    const lines: string[] = [];

    try {
      // Create one purchase per line item
      for (const item of items) {
        const res = await createPurchase(accessToken!, {
          supplierId: supplier.id,
          categoryId: item.categoryId,
          weightKg: item.weightKg,
          pricePerKg: item.pricePerKg,
          idempotencyKey: generateKey(),
        });
        lines.push(
          `${item.categoryName} · ${item.weightKg.toFixed(1)} kg · ${formatMoney(res.totalValueKes)}`,
        );
      }

      // Record payment if cashier paid anything now
      if (paidAmount > 0) {
        await createSupplierPayment(accessToken!, {
          supplierId: supplier.id,
          amountKes: paidAmount,
          paymentMethod: method,
          idempotencyKey: generateKey(),
        });
        lines.push(`Paid: ${formatMoney(paidAmount)} (${method === 'cash' ? 'Cash' : method})`);
      }

      setSuccessLines(lines);
      setStep('success');
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setError('Duplicate entry — this purchase was already recorded.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetSession = () => {
    setSupplier(null);
    setItems([]);
    setAddCategory(null);
    setAddKg('');
    setAddPrice('');
    setPaidNow('');
    setMethod('cash');
    setError(null);
    setStep('form');
    setSuccessLines([]);
  };

  if (loadingData) return <LoadingView message="Loading…" />;

  if (step === 'success') {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <SuccessNote message="Purchase session recorded" />
          <View style={styles.successLines}>
            {successLines.map((line, i) => (
              <Text key={i} style={styles.successLine}>{line}</Text>
            ))}
          </View>
          <Button label="Record another" variant="secondary" onPress={resetSession} fullWidth style={{ marginTop: spacing[4] }} />
        </View>
      </Screen>
    );
  }

  const addLineTotal = parseNumber(addKg) * parseNumber(addPrice);

  return (
    <Screen>
        <OfflineBanner />
        <Text style={styles.pageTitle}>Record Purchase</Text>

        {error ? <ErrorNote message={error} /> : null}

        {/* Supplier */}
        <SelectSheet
          label="Supplier"
          placeholder="Select supplier…"
          value={supplier}
          options={supplierOptions}
          onSelect={setSupplier}
          onQuickCreate={handleQuickCreateSupplier}
          quickCreateLabel="Add supplier"
        />

        {/* Line items list */}
        {items.length > 0 && (
          <View style={styles.itemsCard}>
            <Text style={styles.sectionLabel}>SESSION ITEMS</Text>
            {items.map((item, i) => (
              <View key={item.id} style={[styles.itemRow, i < items.length - 1 && styles.itemRowBorder]}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{item.categoryName}</Text>
                  <Text style={styles.itemMeta}>
                    {item.weightKg.toFixed(2)} kg · KES {item.pricePerKg.toFixed(0)}/kg
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{formatMoney(item.total)}</Text>
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Trash2 size={16} color={colors.muted} strokeWidth={1.75} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.sessionTotal}>
              <Text style={styles.sessionTotalLabel}>Session total</Text>
              <Text style={styles.sessionTotalValue}>{formatMoney(sessionTotal)}</Text>
            </View>
          </View>
        )}

        {/* Add item */}
        <View style={styles.addCard}>
          <Text style={styles.sectionLabel}>ADD ITEM</Text>

          <SelectSheet
            label="Category"
            placeholder="Select scrap type…"
            value={addCategory}
            options={categoryOptions}
            onSelect={handleAddCategorySelect}
          />

          <View style={styles.kgPriceRow}>
            <View style={styles.kgField}>
              <Field
                label="Weight (kg)"
                value={addKg}
                onChangeText={setAddKg}
                keyboardType="decimal-pad"
                placeholder="0.0"
                suffix="kg"
                returnKeyType="next"
              />
            </View>
            <View style={styles.priceField}>
              <Field
                label="Price/kg"
                value={addPrice}
                onChangeText={setAddPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                suffix="KES"
                returnKeyType="done"
              />
            </View>
          </View>

          {addLineTotal > 0 && (
            <Text style={styles.lineTotalPreview}>Line total: {formatMoney(addLineTotal)}</Text>
          )}

          <TouchableOpacity style={styles.addBtn} onPress={addItem} activeOpacity={0.8}>
            <Plus size={18} color={colors.green[800]} strokeWidth={2} />
            <Text style={styles.addBtnLabel}>Add to session</Text>
          </TouchableOpacity>
        </View>

        {/* Payment */}
        {items.length > 0 && (
          <View style={styles.payCard}>
            <Text style={styles.sectionLabel}>PAYMENT</Text>
            <Field
              label="Paid now (KES)"
              value={paidNow}
              onChangeText={setPaidNow}
              keyboardType="decimal-pad"
              placeholder="0"
              hint="Leave 0 — pay later via Pay tab"
              returnKeyType="done"
            />
            {paidAmount > 0 && <MethodPicker value={method} onChange={setMethod} />}

            <Button
              label={submitting ? 'Submitting…' : `Record ${items.length} item${items.length !== 1 ? 's' : ''}`}
              onPress={handleSubmit}
              loading={submitting}
              fullWidth
              style={{ marginTop: spacing[2] }}
            />
          </View>
        )}
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
  sectionLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: spacing[3],
  },
  itemsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
    elevation: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: spacing[2],
  },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemLeft: { flex: 1 },
  itemName: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  itemMeta: { fontSize: fontSize.caption, color: colors.muted, marginTop: 2 },
  itemTotal: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.green[900] },
  removeBtn: { padding: 4 },
  sessionTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sessionTotalLabel: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  sessionTotalValue: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.green[800] },
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
    elevation: 1,
  },
  kgPriceRow: { flexDirection: 'row', gap: spacing[3] },
  kgField: { flex: 1 },
  priceField: { flex: 1 },
  lineTotalPreview: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.medium,
    color: colors.green[800],
    marginBottom: spacing[3],
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.green[800],
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  addBtnLabel: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.green[800] },
  payCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[4],
    elevation: 1,
  },
  successWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing[2] },
  successLines: {
    marginTop: spacing[4],
    backgroundColor: colors.neutral[50] ?? colors.canvas,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: 6,
  },
  successLine: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
});
