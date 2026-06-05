'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PaymentStatusBadge } from '@/lib/badges';
import { formatDate, formatMoney } from '@/lib/format';
import { paginateClient } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { DetailDrawer } from './detail-drawer';
import { OperationalTable, sortRows, type Column } from './operational-table';
import { PaginationBar } from './pagination-bar';
import { WorkspaceLayout } from './workspace-layout';
import { KpiLinkCard } from './kpi-link-card';

type PartyMode = 'supplier' | 'buyer';

interface PartyRow {
  id: string;
  name: string;
  phone?: string | null;
  balanceKes: string | number;
  creditBalanceKes?: string | number;
}

interface PartyDetail {
  id: string;
  name: string;
  balanceKes: number;
  creditBalanceKes?: number;
  unpaidPurchases?: Array<{ id: string; totalValueKes: string; remainingKes: number; paymentStatus: string; createdAt: string }>;
  unpaidSales?: Array<{ id: string; totalValueKes: string; remainingKes: number; paymentStatus: string; createdAt: string }>;
  recentPayments: Array<{ id: string; amountKes: string; createdAt: string; paymentMethod: string }>;
}

export function PartyWorkspace({ mode, tenantSlug }: { mode: PartyMode; tenantSlug: string }) {
  const { accessToken, isAuthReady, hasPermission } = useAuth();
  const base = mode === 'supplier' ? 'suppliers' : 'buyers';
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<PartyDetail | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PartyRow[]>(`/${base}`, { token: accessToken });
      setRows(data);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, base]);

  useEffect(() => {
    if (isAuthReady) load();
  }, [isAuthReady, load]);

  const openDetail = async (id: string) => {
    if (!accessToken) return;
    const detail = await apiFetch<PartyDetail>(`/${base}/${id}`, { token: accessToken });
    setSelected(detail);
  };

  const columns: Column<PartyRow>[] = useMemo(
    () => [
      { key: 'name', header: 'Name', sortable: true, sortValue: (r) => r.name, render: (r) => r.name },
      { key: 'phone', header: 'Phone', render: (r) => r.phone ?? '—' },
      {
        key: 'balance',
        header: mode === 'supplier' ? 'Owed' : 'Receivable',
        sortable: true,
        sortValue: (r) => Number(r.balanceKes),
        render: (r) => formatMoney(r.balanceKes),
      },
      ...(mode === 'supplier'
        ? [
            {
              key: 'credit',
              header: 'Credit',
              sortable: true,
              sortValue: (r: PartyRow) => Number(r.creditBalanceKes ?? 0),
              render: (r: PartyRow) => formatMoney(r.creditBalanceKes ?? 0),
            } as Column<PartyRow>,
          ]
        : []),
    ],
    [mode],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = rows;
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    return sortRows(list, columns, sortKey, sortDir);
  }, [rows, filter, columns, sortKey, sortDir]);

  const paged = paginateClient(filtered, page, pageSize);

  const submitPayment = async () => {
    if (!accessToken || !selected) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    setPaying(true);
    try {
      const path = mode === 'supplier' ? '/supplier-payments' : '/buyer-payments';
      const body =
        mode === 'supplier'
          ? { supplierId: selected.id, amountKes: amount, paymentMethod: 'cash', idempotencyKey: crypto.randomUUID() }
          : { buyerId: selected.id, amountKes: amount, paymentMethod: 'cash', idempotencyKey: crypto.randomUUID() };
      await apiFetch(path, { method: 'POST', token: accessToken, body: JSON.stringify(body) });
      setPayAmount('');
      await load();
      await openDetail(selected.id);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    } finally {
      setPaying(false);
    }
  };

  const totalOwed = rows.reduce((s, r) => s + Number(r.balanceKes), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.creditBalanceKes ?? 0), 0);

  return (
    <>
      <WorkspaceLayout
        kpis={
          <>
            <KpiLinkCard
              href={`/${tenantSlug}/balances`}
              label={mode === 'supplier' ? 'Total owed' : 'Total receivable'}
              value={formatMoney(totalOwed)}
              tone="amber"
            />
            {mode === 'supplier' && (
              <KpiLinkCard
                href={`/${tenantSlug}/balances`}
                label="Credit pool"
                value={formatMoney(totalCredit)}
                tone="green"
              />
            )}
          </>
        }
        filters={
          <input
            className="field-input"
            placeholder="Filter by name…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          />
        }
        primary={
          <>
            {error && <p className="field-error">{error}</p>}
            <OperationalTable
              columns={columns}
              rows={paged.items}
              rowKey={(r) => r.id}
              loading={loading}
              onRowClick={(r) => openDetail(r.id)}
              selectedKey={selected?.id}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => {
                if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                else {
                  setSortKey(k);
                  setSortDir('asc');
                }
              }}
            />
            <PaginationBar
              page={paged.meta.page}
              pageSize={pageSize}
              total={paged.meta.total}
              totalPages={paged.meta.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </>
        }
        secondary={
          <div className="action-panel">
            <h3 className="action-panel__title">Add {mode}</h3>
            <PartyCreateForm mode={mode} onCreated={load} />
          </div>
        }
      />
      <DetailDrawer
        open={!!selected}
        title={selected?.name ?? ''}
        subtitle={mode === 'supplier' ? 'Supplier workspace' : 'Buyer workspace'}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="drawer-sections">
            <section>
              <h4>Balances</h4>
              <p>Owed / receivable: {formatMoney(selected.balanceKes)}</p>
              {mode === 'supplier' && <p>Credit available: {formatMoney(selected.creditBalanceKes ?? 0)}</p>}
            </section>
            <section>
              <h4>Unpaid</h4>
              <ul className="drawer-list">
                {(mode === 'supplier' ? selected.unpaidPurchases : selected.unpaidSales)?.map((t) => (
                  <li key={t.id}>
                    {formatMoney(t.remainingKes)} remaining · <PaymentStatusBadge status={t.paymentStatus} />
                  </li>
                )) ?? <li>None</li>}
              </ul>
            </section>
            <section>
              <h4>Recent payments</h4>
              <ul className="drawer-list">
                {selected.recentPayments?.map((p) => (
                  <li key={p.id}>
                    {formatMoney(p.amountKes)} · {p.paymentMethod} · {formatDate(p.createdAt)}
                  </li>
                ))}
              </ul>
            </section>
            {(mode === 'supplier' ? hasPermission('supplier_payment:create') : hasPermission('buyer_payment:create')) && (
              <section className="drawer-form">
                <h4>{mode === 'supplier' ? 'Pay supplier' : 'Receive payment'}</h4>
                <input
                  className="field-input"
                  type="number"
                  placeholder="Amount KES"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <Button variant="primary" disabled={paying} onClick={submitPayment}>
                  {paying ? 'Processing…' : 'Submit payment'}
                </Button>
              </section>
            )}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}

function PartyCreateForm({ mode, onCreated }: { mode: PartyMode; onCreated: () => void }) {
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !name) return;
    setSaving(true);
    try {
      await apiFetch(`/${mode === 'supplier' ? 'suppliers' : 'buyers'}`, {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({ name, phone: phone || undefined }),
      });
      setName('');
      setPhone('');
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <input className="field-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="field-input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Button variant="primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Create'}
      </Button>
    </form>
  );
}
