'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface KpiLinkCardProps {
  href: string;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'featured' | 'green' | 'blue' | 'amber' | 'neutral';
}

export function KpiLinkCard({
  href,
  label,
  value,
  hint,
  tone = 'neutral',
}: KpiLinkCardProps) {
  return (
    <Link href={href} className={`kpi-card kpi-card--link kpi-card--${tone}`}>
      <span className="kpi-card__label">{label}</span>
      <span className="kpi-card__value">{value}</span>
      {hint && <span className="kpi-card__hint">{hint}</span>}
    </Link>
  );
}
