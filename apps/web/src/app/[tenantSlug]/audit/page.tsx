'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getFetchErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { paginateClient } from '@/lib/types';
import { OperationalTable, type Column } from '@/components/ops/operational-table';
import { PaginationBar } from '@/components/ops/pagination-bar';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  const paged = useMemo(() => paginateClient(rows, page, pageSize), [rows, page, pageSize]);

  if (!hasPermission('audit:view')) {
    return <p className="empty-state">You do not have permission to view audit logs.</p>;
  }

  return (
    <div className="workspace">
      {error && <p className="field-error">{error}</p>}
      <div className="workspace__primary">
        <OperationalTable
          columns={columns}
          rows={paged.items}
          rowKey={(r) => r.id}
          emptyMessage="No audit entries"
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
      </div>
    </div>
  );
}
