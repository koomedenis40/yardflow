import type { AuthMeResponse } from '@yardflow/types';

export interface SessionState {
  accessToken: string;
  refreshToken: string;
  user: AuthMeResponse;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginatedMeta;
}

export const paginateClient = <T>(
  items: T[],
  page: number,
  pageSize: number,
): Paginated<T> => {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    meta: { page: safePage, pageSize, total, totalPages },
  };
};

export const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};
