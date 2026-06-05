'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDayTime, formatMoney, formatWeight } from '@/lib/format';

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'Purchase intake',
  sale: 'Sale outflow',
  purchase_correction: 'Purchase correction',
  sale_correction: 'Sale correction',
  stock_adjustment: 'Stock adjustment',
};

const formatMovementType = (t: string): string => MOVEMENT_LABELS[t] ?? t.replace(/_/g, ' ');
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
            <section>
              <h4>Stock position</h4>
              <dl className="drawer-stats">
                <div><dt>On hand</dt><dd>{formatWeight(selected.weightKg)}</dd></div>
                <div><dt>Avg cost</dt><dd>{formatMoney(selected.averageCostPerKg)}</dd></div>
                <div><dt>Est. value</dt><dd>{formatMoney(Number(selected.weightKg) * Number(selected.averageCostPerKg))}</dd></div>
              </dl>
            </section>
            <section>
              <h4>Recent movements</h4>
              {catMovements.length ? (
                <ul className="drawer-rows">
                  {catMovements.slice(0, 15).map((m) => {
                    const delta = Number(m.weightDeltaKg);
                    return (
                      <li key={m.id} className="drawer-row">
                        <span className="drawer-row__primary">
                          {formatMovementType(m.movementType)}
                        </span>
                        <span className="drawer-row__meta">
                          <span className={delta >= 0 ? 'delta delta--in' : 'delta delta--out'}>
                            {delta >= 0 ? '+' : ''}{formatWeight(m.weightDeltaKg)}
                          </span>
                          {' · '}{formatDayTime(m.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">No movements yet</p>
              )}
            </section>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
