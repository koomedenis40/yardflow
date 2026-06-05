'use client';

import type { ReactNode } from 'react';

interface WorkspaceLayoutProps {
  filters?: ReactNode;
  kpis?: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
}

export function WorkspaceLayout({ filters, kpis, primary, secondary }: WorkspaceLayoutProps) {
  return (
    <div className="workspace">
      {kpis && <div className="workspace__kpis">{kpis}</div>}
      {filters && <div className="workspace__filters">{filters}</div>}
      <div className="workspace__split">
        <div className="workspace__primary">{primary}</div>
        <div className="workspace__secondary">{secondary}</div>
      </div>
    </div>
  );
}
