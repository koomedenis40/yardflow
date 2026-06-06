'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Package,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  formatDate,
  formatDayTime,
  formatMethod,
  formatMoney,
  formatWeight,
  isTodayEat,
  startOfWeekEat,
} from '@/lib/format';
import { Icon } from '@/components/ui/icon';
import { KpiLinkCard } from '@/components/ops/kpi-link-card';
import { TrendBars } from '@/components/ops/trend-bars';

export default function DashboardPage() {
  const tenantSlug = useParams().tenantSlug as string;
  const { accessToken, isAuthReady, hasPermission } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ supplierOwedKes: 0, supplierCreditKes: 0, buyerReceivableKes: 0 });
  const [stock, setStock] = useState<Array<{ weightKg: string; category?: { name: string } }>>([]);
  const [purchases, setPurchases] = useState<Array<{ totalValueKes: string; createdAt: string; supplier?: { name: string } }>>([]);
  const [sales, setSales] = useState<Array<{ totalValueKes: string; createdAt: string; buyer?: { name: string } }>>([]);
  const [supplierPayments, setSupplierPayments] = useState<Array<{ amountKes: string; createdAt: string; paymentMethod: string; supplier?: { name: string } }>>([]);
  const [buyerPayments, setBuyerPayments] = useState<Array<{ amountKes: string; createdAt: string; paymentMethod: string; buyer?: { name: string } }>>([]);
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

  const recentPayments = useMemo(() => {
    const supplierRows = supplierPayments.map((p) => ({
      kind: 'supplier' as const,
      party: p.supplier?.name ?? 'Supplier',
      amountKes: p.amountKes,
      method: p.paymentMethod,
      createdAt: p.createdAt,
    }));
    const buyerRows = buyerPayments.map((p) => ({
      kind: 'buyer' as const,
      party: p.buyer?.name ?? 'Buyer',
      amountKes: p.amountKes,
      method: p.paymentMethod,
      createdAt: p.createdAt,
    }));
    return [...supplierRows, ...buyerRows]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6);
  }, [supplierPayments, buyerPayments]);

  if (loading) return <div className="loading-shell">Loading command center…</div>;

  return (
    <div className="dashboard-sections">
      {error && <p className="field-error">{error}</p>}

      {/* Row 1: Featured stock | Intake | Sales | Quick actions */}
      <section className="dashboard-hero-row" aria-label="Operations overview">
        <KpiLinkCard
          href={`/${tenantSlug}/inventory`}
          label="Total stock on hand"
          value={formatWeight(totalStock)}
          hint="Live inventory across all categories"
          tone="featured"
          icon={Package}
        />
        <KpiLinkCard
          href={`/${tenantSlug}/purchases`}
          label="Intake today"
          value={formatMoney(intakeToday)}
          tone="green"
          icon={ArrowDownToLine}
        />
        <KpiLinkCard
          href={`/${tenantSlug}/sales`}
          label="Sales today"
          value={formatMoney(salesToday)}
          tone="blue"
          icon={ArrowUpFromLine}
        />
        <div className="dashboard-quick-panel">
          <h3 className="dashboard-quick-panel__title">Quick actions</h3>
          {hasPermission('purchase:create') && (
            <Link href={`/${tenantSlug}/purchases`} className="quick-action quick-action--green">
              <Icon icon={ArrowDownToLine} size={18} />
              Record purchase
            </Link>
          )}
          {hasPermission('sale:create') && (
            <Link href={`/${tenantSlug}/sales`} className="quick-action quick-action--blue">
              <Icon icon={ArrowUpFromLine} size={18} />
              Record sale
            </Link>
          )}
          {hasPermission('payment:view') && (
            <Link href={`/${tenantSlug}/balances`} className="quick-action quick-action--neutral">
              <Icon icon={Scale} size={18} />
              View balances
            </Link>
          )}
        </div>
      </section>

      {/* Row 2: Financial settlement — 4 KPIs flat */}
      <section className="dashboard-financial-row" aria-label="Financial settlement">
        <KpiLinkCard href={`/${tenantSlug}/balances`} label="Supplier owed" value={formatMoney(summary.supplierOwedKes)} tone="amber" icon={Wallet} />
        <KpiLinkCard href={`/${tenantSlug}/balances`} label="Buyer receivable" value={formatMoney(summary.buyerReceivableKes)} tone="blue" icon={TrendingUp} />
        <KpiLinkCard href={`/${tenantSlug}/suppliers`} label="Paid today" value={formatMoney(paidToday)} tone="green" icon={Banknote} />
        <KpiLinkCard href={`/${tenantSlug}/buyers`} label="Collected today" value={formatMoney(collectedToday)} tone="blue" icon={Banknote} />
      </section>

      <section className="intel-grid">
        <div className="intel-card">
          <h3>Largest outstanding supplier</h3>
          <p className="intel-card__value">
            {largestOutstanding ? `${largestOutstanding.name} · ${formatMoney(largestOutstanding.balanceKes)}` : 'All clear'}
          </p>
          <Link href={`/${tenantSlug}/suppliers`} className="intel-card__link">View suppliers →</Link>
        </div>
        <TrendBars label="Weekly intake (value)" values={weeklyIntake} formatValue={(n) => formatMoney(n)} />
        <TrendBars label="Weekly sales" values={weeklySales} formatValue={(n) => formatMoney(n)} variant="blue" />
      </section>

      <section className="activity-grid">
        <div className="panel-card">
          <div className="panel-card__header">
            <h3 className="panel-card__title">Recent purchases</h3>
          </div>
          <div className="panel-card__body">
            {purchases.length === 0 ? (
              <p className="muted">No purchases recorded yet</p>
            ) : (
              <ul className="activity-list">
                {purchases.slice(0, 6).map((p, i) => (
                  <li key={i} className="activity-item">
                    <span className="activity-item__primary">{p.supplier?.name ?? '—'}</span>
                    <span className="activity-item__meta">{formatMoney(p.totalValueKes)} · {formatDate(p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="panel-card">
          <div className="panel-card__header">
            <h3 className="panel-card__title">Recent sales</h3>
          </div>
          <div className="panel-card__body">
            {sales.length === 0 ? (
              <p className="muted">No sales recorded yet</p>
            ) : (
              <ul className="activity-list">
                {sales.slice(0, 6).map((s, i) => (
                  <li key={i} className="activity-item">
                    <span className="activity-item__primary">{s.buyer?.name ?? '—'}</span>
                    <span className="activity-item__meta">{formatMoney(s.totalValueKes)} · {formatDate(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="panel-card">
          <div className="panel-card__header">
            <h3 className="panel-card__title">Recent payments</h3>
          </div>
          <div className="panel-card__body">
            {recentPayments.length === 0 ? (
              <p className="muted">No payments recorded yet</p>
            ) : (
              <ul className="activity-list">
                {recentPayments.map((p, i) => (
                  <li key={i} className="activity-item activity-item--stacked">
                    <span className="activity-item__primary">
                      {p.kind === 'supplier' ? 'Paid ' : 'Collected from '}
                      {p.party}
                    </span>
                    <span className="activity-item__meta">
                      {formatMoney(p.amountKes)} · {formatMethod(p.method)} · {formatDayTime(p.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
