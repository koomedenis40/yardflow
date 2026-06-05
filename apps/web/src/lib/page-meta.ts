export interface PageMeta {
  title: string;
  subtitle: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  dashboard: { title: 'Dashboard', subtitle: 'Operational overview' },
  suppliers: { title: 'Suppliers', subtitle: 'Parties & settlements' },
  buyers: { title: 'Buyers', subtitle: 'Receivables & collections' },
  purchases: { title: 'Purchases', subtitle: 'Stock intake' },
  sales: { title: 'Sales', subtitle: 'Stock outbound' },
  inventory: { title: 'Inventory', subtitle: 'Stock positions' },
  categories: { title: 'Categories', subtitle: 'Scrap types & defaults' },
  balances: { title: 'Balances', subtitle: 'Settlement summary' },
  audit: { title: 'Audit', subtitle: 'Activity trail' },
  settings: { title: 'Settings', subtitle: 'Tenant preferences' },
};

export const pageMetaFor = (segment: string, tenantName?: string): PageMeta => {
  const base = PAGE_META[segment] ?? { title: 'YardFlow', subtitle: 'Operations' };
  const prefix = tenantName ?? 'Yard';
  return { title: base.title, subtitle: `${prefix} · ${base.subtitle}` };
};
