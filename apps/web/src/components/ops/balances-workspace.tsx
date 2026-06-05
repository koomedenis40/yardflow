'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatMoney } from '@/lib/format';
import { KpiGroup } from './kpi-group';
import { KpiLinkCard } from './kpi-link-card';
import { OperationalTable, type Column } from './operational-table';

interface Summary {
  supplierOwedKes: number;
  supplierCreditKes: number;
  buyerReceivableKes: number;
}

interface SupplierBalance {
  id: string;
  name: string;
  balanceKes: string;
  creditBalanceKes: string;
}

interface BuyerBalance {
  id: string;
  name: string;
  balanceKes: string;
}

export function BalancesWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const { accessToken, isAuthReady } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierBalance[]>([]);
  const [buyers, setBuyers] = useState<BuyerBalance[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [s, sup, buy] = await Promise.all([
        apiFetch<Summary>('/balances/summary', { token: accessToken }),
        apiFetch<SupplierBalance[]>('/balances/suppliers', { token: accessToken }),
        apiFetch<BuyerBalance[]>('/balances/buyers', { token: accessToken }),
      ]);
      setSummary(s);
      setSuppliers(sup);
      setBuyers(buy);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthReady) load();
  }, [isAuthReady, load]);

  const supCols: Column<SupplierBalance>[] = [
    { key: 'name', header: 'Supplier', render: (r) => r.name },
    { key: 'owed', header: 'Owed', render: (r) => formatMoney(r.balanceKes) },
    { key: 'credit', header: 'Credit', render: (r) => formatMoney(r.creditBalanceKes) },
  ];

  const buyCols: Column<BuyerBalance>[] = [
    { key: 'name', header: 'Buyer', render: (r) => r.name },
    { key: 'rec', header: 'Receivable', render: (r) => formatMoney(r.balanceKes) },
  ];

  return (
    <div className="dashboard-sections">
      {error && <p className="field-error">{error}</p>}
      {summary && (
        <KpiGroup title="Settlement summary">
          <KpiLinkCard href={`/${tenantSlug}/suppliers`} label="Supplier owed" value={formatMoney(summary.supplierOwedKes)} tone="amber" />
          <KpiLinkCard href={`/${tenantSlug}/suppliers`} label="Supplier credit" value={formatMoney(summary.supplierCreditKes)} tone="green" />
          <KpiLinkCard href={`/${tenantSlug}/buyers`} label="Buyer receivable" value={formatMoney(summary.buyerReceivableKes)} tone="blue" />
        </KpiGroup>
      )}
      <div className="balances-split">
        <section>
          <h3>Suppliers</h3>
          <OperationalTable columns={supCols} rows={suppliers.filter((s) => Number(s.balanceKes) > 0 || Number(s.creditBalanceKes) > 0)} rowKey={(r) => r.id} />
        </section>
        <section>
          <h3>Buyers</h3>
          <OperationalTable columns={buyCols} rows={buyers.filter((b) => Number(b.balanceKes) > 0)} rowKey={(r) => r.id} />
        </section>
      </div>
    </div>
  );
}
