export type SearchScope =
  | 'all'
  | 'suppliers'
  | 'buyers'
  | 'purchases'
  | 'sales'
  | 'categories';

export interface GlobalSearchQuery {
  q: string;
  scope: SearchScope;
  tenantSlug: string;
}

export const SEARCH_SCOPES: { id: SearchScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'buyers', label: 'Buyers' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'sales', label: 'Sales' },
  { id: 'categories', label: 'Categories' },
];

export const buildSearchApiPath = (_query: GlobalSearchQuery): string | null => null;
