'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMoney, formatWeight } from '@/lib/format';
import { paginateClient } from '@/lib/types';
import { DetailDrawer } from './detail-drawer';
import { OperationalTable, sortRows, type Column } from './operational-table';
import { PaginationBar } from './pagination-bar';
import { WorkspaceLayout } from './workspace-layout';
import { KpiLinkCard } from './kpi-link-card';

interface StockRow {
  categoryId: string;
  category?: { name: string };
  weightKg: string;
  averageCostPerKg: string;
}

interface MovementRow {
  id: string;
  movementType: string;
  weightDeltaKg: string;
  valueDeltaKes: string;
  createdAt: string;
  category?: { name: string };
}

export function InventoryWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const { accessToken, isAuthReady } = useAuth();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState('weightKg');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<StockRow | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [balances, mov] = await Promise.all([
        apiFetch<StockRow[]>('/inventory', { token: accessToken }),
        apiFetch<MovementRow[]>('/inventory/movements', { token: accessToken }),
      ]);
      setStock(balances);
      setMovements(mov);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthReady) load();
  }, [isAuthReady, load]);

  const totalKg = stock.reduce((s, r) => s + Number(r.weightKg), 0);

  const columns: Column<StockRow>[] = useMemo(() => [
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      sortValue: (r) => r.category?.name ?? '',
      render: (r) => r.category?.name ?? r.categoryId.slice(0, 8),
    },
    {
      key: 'weightKg',
      header: 'Stock',
      sortable: true,
      sortValue: (r) => Number(r.weightKg),
      render: (r) => formatWeight(r.weightKg),
    },
    {
      key: 'avg',
      header: 'Avg cost/kg',
      sortable: true,
      sortValue: (r) => Number(r.averageCostPerKg),
      render: (r) => formatMoney(r.averageCostPerKg),
    },
    {
      key: 'value',
      header: 'Est. value',
      sortable: true,
      sortValue: (r) => Number(r.weightKg) * Number(r.averageCostPerKg),
      render: (r) => formatMoney(Number(r.weightKg) * Number(r.averageCostPerKg)),
    },
  ], []);

  const sorted = useMemo(
    () => sortRows(stock, columns, sortKey, sortDir),
    [stock, columns, sortKey, sortDir],
  );
  const paged = paginateClient(sorted, page, pageSize);

  const catMovements = selected
    ? movements.filter((m) => (m as MovementRow & { categoryId?: string }).categoryId === selected.categoryId || m.category?.name === selected.category?.name)
    : [];

  return (
    <>
      <WorkspaceLayout
        kpis={
          <KpiLinkCard
            href={`/${tenantSlug}/inventory`}
            label="Total stock"
            value={formatWeight(totalKg)}
            tone="featured"
          />
        }
        primary={
          <>
            {error && <p className="field-error">{error}</p>}
            <OperationalTable
              columns={columns}
              rows={paged.items}
              rowKey={(r) => r.categoryId}
              loading={loading}
              onRowClick={setSelected}
              selectedKey={selected?.categoryId}
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
            <h3 className="action-panel__title">Stock overview</h3>
            <p className="muted">{stock.length} categories tracked</p>
          </div>
        }
      />
      <DetailDrawer
        open={!!selected}
        title={selected?.category?.name ?? 'Category'}
        subtitle="Stock detail"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="drawer-sections">
            <p>On hand: {formatWeight(selected.weightKg)}</p>
            <p>Avg cost: {formatMoney(selected.averageCostPerKg)}</p>
            <p>Value: {formatMoney(Number(selected.weightKg) * Number(selected.averageCostPerKg))}</p>
            <h4>Recent movements</h4>
            <ul className="drawer-list">
              {catMovements.slice(0, 15).map((m) => (
                <li key={m.id}>
                  {m.movementType} {formatWeight(m.weightDeltaKg)} · {formatDate(m.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
