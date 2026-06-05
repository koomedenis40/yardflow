'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PaymentStatusBadge } from '@/lib/badges';
import { formatDate, formatMethod, formatMoney, formatWeight } from '@/lib/format';
import { paginateClient } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { DetailDrawer } from './detail-drawer';
import { OperationalTable, sortRows, type Column } from './operational-table';
import { PaginationBar } from './pagination-bar';
import { WorkspaceLayout } from './workspace-layout';

type LedgerMode = 'purchase' | 'sale';

interface LedgerRow {
  id: string;
  weightKg: string;
  pricePerKg: string;
  totalValueKes: string;
  paymentStatus: string;
  createdAt: string;
  supplier?: { name: string };
  buyer?: { name: string };
  category?: { name: string };
}

interface LedgerDetail extends LedgerRow {
  paidAmountKes?: number;
  remainingKes?: number;
  grossProfitKes?: string;
  allocations?: Array<{ allocatedAmountKes: string; sourceType: string; createdAt: string }>;
}

export function LedgerWorkspace({ mode }: { mode: LedgerMode }) {
  const { accessToken, isAuthReady } = useAuth();
  const path = mode === 'purchase' ? 'purchases' : 'sales';
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<LedgerDetail | null>(null);

  const [partyId, setPartyId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [list, cats, pts] = await Promise.all([
        apiFetch<LedgerRow[]>(`/${path}`, { token: accessToken }),
        apiFetch<Array<{ id: string; name: string }>>('/categories', { token: accessToken }),
        apiFetch<Array<{ id: string; name: string }>>(
          `/${mode === 'purchase' ? 'suppliers' : 'buyers'}`,
          { token: accessToken },
        ),
      ]);
      setRows(list);
      setCategories(cats);
      setParties(pts);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, path, mode]);

  useEffect(() => {
    if (isAuthReady) load();
  }, [isAuthReady, load]);

  const columns: Column<LedgerRow>[] = useMemo(() => [
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      sortValue: (r) => r.createdAt,
      render: (r) => formatDate(r.createdAt),
    },
    {
      key: 'party',
      header: mode === 'purchase' ? 'Supplier' : 'Buyer',
      render: (r) => (mode === 'purchase' ? r.supplier?.name : r.buyer?.name) ?? '—',
    },
    {
      key: 'weight',
      header: 'Weight',
      sortable: true,
      sortValue: (r) => Number(r.weightKg),
      render: (r) => formatWeight(r.weightKg),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      sortValue: (r) => Number(r.totalValueKes),
      render: (r) => formatMoney(r.totalValueKes),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <PaymentStatusBadge status={r.paymentStatus} />,
    },
  ], [mode]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter) list = list.filter((r) => r.paymentStatus === statusFilter);
    return sortRows(list, columns, sortKey, sortDir);
  }, [rows, statusFilter, columns, sortKey, sortDir]);

  const paged = paginateClient(filtered, page, pageSize);

  const openDetail = async (id: string) => {
    if (!accessToken) return;
    const d = await apiFetch<LedgerDetail>(`/${path}/${id}`, { token: accessToken });
    setSelected(d);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const body = {
        ...(mode === 'purchase' ? { supplierId: partyId } : { buyerId: partyId }),
        categoryId,
        weightKg: Number(weightKg),
        pricePerKg: Number(pricePerKg),
        idempotencyKey: crypto.randomUUID(),
      };
      await apiFetch(`/${path}`, { method: 'POST', token: accessToken, body: JSON.stringify(body) });
      setWeightKg('');
      setPricePerKg('');
      await load();
    } catch (err) {
      setError(getFetchErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <WorkspaceLayout
        filters={
          <select
            className="field-input field-input--compact"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
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
          <form className="stack-form action-panel" onSubmit={submit}>
            <h3 className="action-panel__title">Record {mode}</h3>
            <select className="field-input" value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
              <option value="">{mode === 'purchase' ? 'Supplier' : 'Buyer'}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select className="field-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input className="field-input" placeholder="Weight kg" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required />
            <input className="field-input" placeholder="Price/kg" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} required />
            <Button variant={mode === 'purchase' ? 'primary' : 'sale'} type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Submit'}
            </Button>
          </form>
        }
      />
      <DetailDrawer
        open={!!selected}
        title={mode === 'purchase' ? 'Purchase detail' : 'Sale detail'}
        subtitle={selected ? formatDate(selected.createdAt) : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="drawer-sections">
            <section>
              <div className="drawer-status-row">
                <h4>Settlement</h4>
                <PaymentStatusBadge status={selected.paymentStatus} />
              </div>
              <dl className="drawer-stats">
                <div><dt>Total</dt><dd>{formatMoney(selected.totalValueKes)}</dd></div>
                <div><dt>Paid</dt><dd>{formatMoney(selected.paidAmountKes ?? 0)}</dd></div>
                <div><dt>Remaining</dt><dd>{formatMoney(selected.remainingKes ?? 0)}</dd></div>
                {mode === 'sale' && selected.grossProfitKes && (
                  <div><dt>Profit</dt><dd>{formatMoney(selected.grossProfitKes)}</dd></div>
                )}
              </dl>
            </section>
            <section>
              <h4>Allocations</h4>
              {selected.allocations && selected.allocations.length > 0 ? (
                <ul className="drawer-rows">
                  {selected.allocations.map((a, i) => (
                    <li key={i} className="drawer-row">
                      <span className="drawer-row__primary">{formatMoney(a.allocatedAmountKes)}</span>
                      <span className="drawer-row__meta">{formatMethod(a.sourceType)} · {formatDate(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No allocations yet</p>
              )}
            </section>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
