'use client';

import type { ReactNode } from 'react';

interface DetailDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export function DetailDrawer({ open, title, subtitle, onClose, children }: DetailDrawerProps) {
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
            ✕
          </button>
        </header>
        <div className="detail-drawer__body">{children}</div>
      </aside>
    </div>
  );
}
