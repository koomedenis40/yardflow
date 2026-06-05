'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DetailDrawer } from './detail-drawer';
import { OperationalTable, type Column } from './operational-table';
import { WorkspaceLayout } from './workspace-layout';

interface CategoryRow {
  id: string;
  name: string;
  defaultBuyingPricePerKg: string;
  defaultSellingPricePerKg: string;
  isActive: boolean;
  sortOrder: number;
}

export function CategoriesWorkspace() {
  const { accessToken, isAuthReady, hasPermission } = useAuth();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CategoryRow | null>(null);
  const [name, setName] = useState('');
  const [buy, setBuy] = useState('');
  const [sell, setSell] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<CategoryRow[]>('/categories?includeInactive=true', {
        token: accessToken,
      });
      setRows(data);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthReady) load();
  }, [isAuthReady, load]);

  const columns: Column<CategoryRow>[] = [
    { key: 'name', header: 'Name', render: (r) => r.name },
    { key: 'buy', header: 'Buy/kg', render: (r) => formatMoney(r.defaultBuyingPricePerKg) },
    { key: 'sell', header: 'Sell/kg', render: (r) => formatMoney(r.defaultSellingPricePerKg) },
    {
      key: 'active',
      header: 'Status',
      render: (r) => (r.isActive ? <span className="badge badge--paid">active</span> : <span className="badge badge--unpaid">inactive</span>),
    },
  ];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    await apiFetch('/categories', {
      method: 'POST',
      token: accessToken,
      body: JSON.stringify({
        name,
        defaultBuyingPricePerKg: Number(buy) || 0,
        defaultSellingPricePerKg: Number(sell) || 0,
      }),
    });
    setName('');
    setBuy('');
    setSell('');
    load();
  };

  const deactivate = async (id: string) => {
    if (!accessToken) return;
    await apiFetch(`/categories/${id}`, {
      method: 'PATCH',
      token: accessToken,
      body: JSON.stringify({ isActive: false }),
    });
    setSelected(null);
    load();
  };

  return (
    <>
      <WorkspaceLayout
        primary={
          <>
            {error && <p className="field-error">{error}</p>}
            <OperationalTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              loading={loading}
              onRowClick={setSelected}
              selectedKey={selected?.id}
            />
          </>
        }
        secondary={
          hasPermission('category:create') ? (
            <form className="stack-form action-panel" onSubmit={create}>
              <h3 className="action-panel__title">New category</h3>
              <input className="field-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input className="field-input" placeholder="Default buy/kg" value={buy} onChange={(e) => setBuy(e.target.value)} />
              <input className="field-input" placeholder="Default sell/kg" value={sell} onChange={(e) => setSell(e.target.value)} />
              <Button variant="primary" type="submit">Create</Button>
            </form>
          ) : (
            <p className="muted">No create permission</p>
          )
        }
      />
      <DetailDrawer open={!!selected} title={selected?.name ?? ''} onClose={() => setSelected(null)}>
        {selected && hasPermission('category:deactivate') && selected.isActive && (
          <Button variant="danger" onClick={() => deactivate(selected.id)}>
            Deactivate
          </Button>
        )}
      </DetailDrawer>
    </>
  );
}
