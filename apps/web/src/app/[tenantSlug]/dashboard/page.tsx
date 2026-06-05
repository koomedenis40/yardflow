'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMoney, formatWeight, isTodayEat, startOfWeekEat } from '@/lib/format';
import { KpiGroup } from '@/components/ops/kpi-group';
import { KpiLinkCard } from '@/components/ops/kpi-link-card';
import { TrendBars } from '@/components/ops/trend-bars';

export default function DashboardPage() {
  const tenantSlug = useParams().tenantSlug as string;
  const { accessToken, isAuthReady } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ supplierOwedKes: 0, supplierCreditKes: 0, buyerReceivableKes: 0 });
  const [stock, setStock] = useState<Array<{ weightKg: string; category?: { name: string } }>>([]);
  const [purchases, setPurchases] = useState<Array<{ totalValueKes: string; createdAt: string; supplier?: { name: string } }>>([]);
  const [sales, setSales] = useState<Array<{ totalValueKes: string; createdAt: string; buyer?: { name: string } }>>([]);
  const [supplierPayments, setSupplierPayments] = useState<Array<{ amountKes: string; createdAt: string }>>([]);
  const [buyerPayments, setBuyerPayments] = useState<Array<{ amountKes: string; createdAt: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ name: string; balanceKes: string }>>([]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [bal, inv, pur, sal, sp, bp, sup] = await Promise.all([
        apiFetch<{ supplierOwedKes: number; supplierCreditKes: number; buyerReceivableKes: number }>('/balances/summary', { token: accessToken }),
        apiFetch<Array<{ weightKg: string; category?: { name: string } }>>('/inventory', { token: accessToken }),
        apiFetch<typeof purchases>('/purchases', { token: accessToken }),
        apiFetch<typeof sales>('/sales', { token: accessToken }),
        apiFetch<typeof supplierPayments>('/supplier-payments', { token: accessToken }),
        apiFetch<typeof buyerPayments>('/buyer-payments', { token: accessToken }),
        apiFetch<typeof suppliers>('/balances/suppliers', { token: accessToken }),
      ]);
      setSummary(bal);
      setStock(inv);
      setPurchases(pur);
      setSales(sal);
      setSupplierPayments(sp);
      setBuyerPayments(bp);
      setSuppliers(sup);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthReady) load();
  }, [isAuthReady, load]);

  const totalStock = stock.reduce((s, r) => s + Number(r.weightKg), 0);
  const intakeToday = purchases.filter((p) => isTodayEat(p.createdAt)).reduce((s, p) => s + Number(p.totalValueKes), 0);
  const salesToday = sales.filter((s) => isTodayEat(s.createdAt)).reduce((s, x) => s + Number(x.totalValueKes), 0);
  const paidToday = supplierPayments.filter((p) => isTodayEat(p.createdAt)).reduce((s, p) => s + Number(p.amountKes), 0);
  const collectedToday = buyerPayments.filter((p) => isTodayEat(p.createdAt)).reduce((s, p) => s + Number(p.amountKes), 0);

  const weekStart = startOfWeekEat();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weeklyIntake = weekDays.map((d) =>
    purchases
      .filter((p) => new Date(p.createdAt).toDateString() === d.toDateString())
      .reduce((s, p) => s + Number(p.totalValueKes), 0),
  );
  const weeklySales = weekDays.map((d) =>
    sales
      .filter((s) => new Date(s.createdAt).toDateString() === d.toDateString())
      .reduce((sum, x) => sum + Number(x.totalValueKes), 0),
  );

  const largestOutstanding = useMemo(() => {
    const sorted = [...suppliers].sort((a, b) => Number(b.balanceKes) - Number(a.balanceKes));
    return sorted.find((s) => Number(s.balanceKes) > 0);
  }, [suppliers]);

  const topCategories = useMemo(
    () => [...stock].sort((a, b) => Number(b.weightKg) - Number(a.weightKg)).slice(0, 5),
    [stock],
  );

  if (loading) return <div className="loading-shell">Loading command center…</div>;

  return (
    <div className="dashboard-sections">
      {error && <p className="field-error">{error}</p>}

      <KpiGroup title="Operations">
        <KpiLinkCard href={`/${tenantSlug}/inventory`} label="Total stock" value={formatWeight(totalStock)} tone="featured" />
        <KpiLinkCard href={`/${tenantSlug}/purchases`} label="Intake today" value={formatMoney(intakeToday)} tone="green" />
        <KpiLinkCard href={`/${tenantSlug}/sales`} label="Sales today" value={formatMoney(salesToday)} tone="blue" />
      </KpiGroup>

      <KpiGroup title="Financial settlement">
        <KpiLinkCard href={`/${tenantSlug}/balances`} label="Supplier owed" value={formatMoney(summary.supplierOwedKes)} tone="amber" />
        <KpiLinkCard href={`/${tenantSlug}/balances`} label="Buyer receivable" value={formatMoney(summary.buyerReceivableKes)} tone="blue" />
        <KpiLinkCard href={`/${tenantSlug}/suppliers`} label="Paid today" value={formatMoney(paidToday)} tone="green" />
        <KpiLinkCard href={`/${tenantSlug}/buyers`} label="Collected today" value={formatMoney(collectedToday)} tone="blue" />
      </KpiGroup>

      <section className="intel-grid">
        <div className="intel-card">
          <h3>Largest outstanding supplier</h3>
          <p className="intel-card__value">
            {largestOutstanding ? `${largestOutstanding.name} · ${formatMoney(largestOutstanding.balanceKes)}` : 'All clear'}
          </p>
          <Link href={`/${tenantSlug}/suppliers`} className="intel-card__link">View suppliers</Link>
        </div>
        <TrendBars label="Weekly intake (value)" values={weeklyIntake} formatValue={(n) => formatMoney(n)} />
        <TrendBars label="Weekly sales" values={weeklySales} formatValue={(n) => formatMoney(n)} />
      </section>

      <section className="activity-grid">
        <div className="activity-card">
          <h3>Recent purchases</h3>
          <ul>
            {purchases.slice(0, 6).map((p, i) => (
              <li key={i}>{p.supplier?.name ?? '—'} · {formatMoney(p.totalValueKes)} · {formatDate(p.createdAt)}</li>
            ))}
          </ul>
        </div>
        <div className="activity-card">
          <h3>Recent sales</h3>
          <ul>
            {sales.slice(0, 6).map((s, i) => (
              <li key={i}>{s.buyer?.name ?? '—'} · {formatMoney(s.totalValueKes)} · {formatDate(s.createdAt)}</li>
            ))}
          </ul>
        </div>
        <div className="activity-card">
          <h3>Recent payments</h3>
          <ul>
            {[...supplierPayments, ...buyerPayments]
              .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
              .slice(0, 6)
              .map((p, i) => (
                <li key={i}>{formatMoney(p.amountKes)} · {formatDate(p.createdAt)}</li>
              ))}
          </ul>
        </div>
      </section>

      <section className="categories-strip">
        <h3>Top categories by stock</h3>
        <div className="categories-strip__grid">
          {topCategories.map((c, i) => (
            <Link key={i} href={`/${tenantSlug}/inventory`} className="category-chip">
              <span>{c.category?.name ?? 'Category'}</span>
              <strong>{formatWeight(c.weightKg)}</strong>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
