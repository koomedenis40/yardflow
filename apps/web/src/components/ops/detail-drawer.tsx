'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

interface DetailDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky footer — use for action forms (pay, collect) so they stay visible while body scrolls. */
  footer?: ReactNode;
}

export function DetailDrawer({ open, title, subtitle, onClose, children, footer }: DetailDrawerProps) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="detail-drawer"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="detail-drawer__header">
          <div>
            <h2 className="detail-drawer__title">{title}</h2>
            {subtitle && <p className="detail-drawer__subtitle">{subtitle}</p>}
          </div>
          <button className="btn btn--ghost btn--compact" onClick={onClose} aria-label="Close">
            <Icon icon={X} size={16} />
          </button>
        </header>
        <div className="detail-drawer__body">{children}</div>
        {footer && <div className="detail-drawer__footer">{footer}</div>}
      </aside>
    </div>
  );
}
