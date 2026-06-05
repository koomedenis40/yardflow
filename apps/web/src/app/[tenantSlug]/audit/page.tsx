'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { OperationalTable, type Column } from '@/components/ops/operational-table';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
}

export default function AuditPage() {
  const { accessToken, isAuthReady, hasPermission } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<AuditRow[]>('/audit/logs', { token: accessToken });
      setRows(data);
    } catch (e) {
      setError(getFetchErrorMessage(e));
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthReady) load();
  }, [isAuthReady, load]);

  const columns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', render: (r) => formatDate(r.createdAt) },
    { key: 'action', header: 'Action', render: (r) => r.action },
    { key: 'entity', header: 'Entity', render: (r) => r.entityType },
  ];

  if (!hasPermission('audit:view')) {
    return <p className="empty-state">You do not have permission to view audit logs.</p>;
  }

  return (
    <div>
      {error && <p className="field-error">{error}</p>}
      <OperationalTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No audit entries" />
    </div>
  );
}
