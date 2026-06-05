'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { pageMetaFor } from '@/lib/page-meta';
import { CommandHeader } from './ops/command-header';

const NAV = [
  { href: 'dashboard', label: 'Dashboard', icon: '◉' },
  { href: 'purchases', label: 'Purchases', icon: '↓', perm: 'purchase:view' },
  { href: 'sales', label: 'Sales', icon: '↑', perm: 'sale:view' },
  { href: 'inventory', label: 'Inventory', icon: '▣', perm: 'inventory:view' },
  { href: 'suppliers', label: 'Suppliers', icon: '◎', perm: 'supplier:view' },
  { href: 'buyers', label: 'Buyers', icon: '○', perm: 'buyer:view' },
  { href: 'balances', label: 'Balances', icon: '₣', perm: 'payment:view' },
  { href: 'categories', label: 'Categories', icon: '▤', perm: 'category:view' },
  { href: 'audit', label: 'Audit', icon: '☰', perm: 'audit:view' },
  { href: 'settings', label: 'Settings', icon: '⚙', perm: 'tenant:view' },
];

export function TenantShell({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthReady, hasPermission } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthReady) router.replace('/login');
  }, [isLoading, isAuthReady, router]);

  if (isLoading || !isAuthReady) {
    return <div className="loading-shell">Loading workspace…</div>;
  }

  const segment = pathname.split('/').pop() ?? 'dashboard';
  const meta = pageMetaFor(segment, tenantSlug.replace(/-/g, ' '));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo">YardFlow</span>
          <span className="sidebar__tenant">{tenantSlug}</span>
        </div>
        <nav className="sidebar__nav">
          {NAV.filter((n) => !n.perm || hasPermission(n.perm)).map((item) => {
            const href = `/${tenantSlug}/${item.href}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={item.href}
                href={href}
                className={active ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="main-column">
        <CommandHeader title={meta.title} subtitle={meta.subtitle} tenantSlug={tenantSlug} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
