'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { GlobalSearch } from './global-search';

interface CommandHeaderProps {
  title: string;
  subtitle: string;
  tenantSlug: string;
}

export function CommandHeader({ title, subtitle, tenantSlug }: CommandHeaderProps) {
  const { session, logout, hasPermission } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <header className="command-header">
      <div className="command-header__left">
        <h1 className="command-header__title">{title}</h1>
        <p className="command-header__subtitle">{subtitle}</p>
      </div>
      <div className="command-header__center">
        <GlobalSearch tenantSlug={tenantSlug} />
      </div>
      <div className="command-header__right">
        <button type="button" className="command-header__icon-btn" aria-label="Notifications">
          <span className="command-header__dot" />
          🔔
        </button>
        <div className="command-header__dropdown">
          <button
            type="button"
            className="btn btn--primary btn--compact"
            onClick={() => setActionsOpen((v) => !v)}
          >
            Quick actions ▾
          </button>
          {actionsOpen && (
            <div className="command-header__menu">
              {hasPermission('purchase:create') && (
                <Link href={`/${tenantSlug}/purchases`} onClick={() => setActionsOpen(false)}>
                  Record purchase
                </Link>
              )}
              {hasPermission('sale:create') && (
                <Link href={`/${tenantSlug}/sales`} onClick={() => setActionsOpen(false)}>
                  Record sale
                </Link>
              )}
              {hasPermission('inventory:view') && (
                <Link href={`/${tenantSlug}/inventory`} onClick={() => setActionsOpen(false)}>
                  View inventory
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="command-header__dropdown">
          <button
            type="button"
            className="command-header__user"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="command-header__avatar">
              {session?.user.fullName?.charAt(0) ?? 'U'}
            </span>
          </button>
          {menuOpen && (
            <div className="command-header__menu command-header__menu--user">
              <p className="command-header__user-name">{session?.user.fullName}</p>
              <p className="command-header__user-email">{session?.user.email}</p>
              <p className="command-header__user-role">{session?.user.role}</p>
              <button type="button" className="btn btn--ghost" onClick={logout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
