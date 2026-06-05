import type { ReactNode } from 'react';

export function KpiGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kpi-group" aria-label={title}>
      <h2 className="kpi-group__title">{title}</h2>
      <div className="kpi-group__grid">{children}</div>
    </section>
  );
}
