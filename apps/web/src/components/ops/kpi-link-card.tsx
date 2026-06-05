'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

interface KpiLinkCardProps {
  href: string;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'featured' | 'green' | 'blue' | 'amber' | 'neutral';
  icon?: LucideIcon;
}

export function KpiLinkCard({
  href,
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: KpiLinkCardProps) {
  return (
    <Link href={href} className={`kpi-card kpi-card--link kpi-card--${tone}`}>
      <div className="kpi-card__head">
        <span className="kpi-card__label">{label}</span>
        {icon && <Icon icon={icon} size={18} className="kpi-card__icon" />}
      </div>
      <span className="kpi-card__value">{value}</span>
      {hint && <span className="kpi-card__hint">{hint}</span>}
    </Link>
  );
}
