'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  LayoutDashboard,
  Package,
  Scale,
  Settings,
  Tags,
  Truck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { pageMetaFor } from '@/lib/page-meta';
import { Icon } from '@/components/ui/icon';
import { CommandHeader } from './ops/command-header';

type NavTone = 'green' | 'blue' | 'neutral';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: string;
  tone?: NavTone;
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { href: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tone: 'neutral' },
      { href: 'purchases', label: 'Purchases', icon: ArrowDownToLine, perm: 'purchase:view', tone: 'green' },
      { href: 'sales', label: 'Sales', icon: ArrowUpFromLine, perm: 'sale:view', tone: 'blue' },
      { href: 'inventory', label: 'Inventory', icon: Package, perm: 'inventory:view', tone: 'green' },
    ],
  },
  {
    label: 'Parties & settlement',
    items: [
      { href: 'suppliers', label: 'Suppliers', icon: Truck, perm: 'supplier:view', tone: 'neutral' },
      { href: 'buyers', label: 'Buyers', icon: Users, perm: 'buyer:view', tone: 'neutral' },
      { href: 'balances', label: 'Balances', icon: Scale, perm: 'payment:view', tone: 'neutral' },
      { href: 'categories', label: 'Categories', icon: Tags, perm: 'category:view', tone: 'neutral' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: 'audit', label: 'Audit', icon: ClipboardList, perm: 'audit:view', tone: 'neutral' },
      { href: 'settings', label: 'Settings', icon: Settings, perm: 'tenant:view', tone: 'neutral' },
    ],
  },
];

function activeClass(active: boolean, tone: NavTone = 'neutral') {
  if (!active) return 'sidebar__link';
  if (tone === 'green') return 'sidebar__link sidebar__link--active';
  if (tone === 'blue') return 'sidebar__link sidebar__link--active-blue';
  return 'sidebar__link sidebar__link--active-neutral';
}

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
          <span className="sidebar__logo">
            <span className="sidebar__logo-mark">
              <Icon icon={Package} size={16} strokeWidth={2} />
            </span>
            YardFlow
          </span>
          <span className="sidebar__tenant">{tenantSlug.replace(/-/g, ' ')}</span>
        </div>
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((n) => !n.perm || hasPermission(n.perm));
          if (items.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="sidebar__section-label">{section.label}</p>
              <nav className="sidebar__nav">
                {items.map((item) => {
                  const href = `/${tenantSlug}/${item.href}`;
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      className={activeClass(active, item.tone)}
                    >
                      <Icon icon={item.icon} size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </aside>
      <div className="main-column">
        <CommandHeader title={meta.title} subtitle={meta.subtitle} tenantSlug={tenantSlug} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
