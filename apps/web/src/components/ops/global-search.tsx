'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { SEARCH_SCOPES, type SearchScope } from '@/lib/search-types';

export function GlobalSearch({ tenantSlug }: { tenantSlug: string }) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const showPopover = open && (q.length > 0 || true);

  return (
    <div className="global-search" data-tenant={tenantSlug} ref={rootRef}>
      <div className="global-search__wrap">
        <Icon icon={Search} size={16} className="global-search__icon" />
        <input
          ref={inputRef}
          className="global-search__input"
          placeholder="Search operations…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          aria-label="Global search"
        />
        <kbd className="global-search__kbd">Ctrl K</kbd>
      </div>
      {showPopover && (
        <div className="global-search__popover" role="dialog" aria-label="Search scopes">
          <div className="global-search__scopes" role="tablist">
            {SEARCH_SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={scope === s.id}
                className={scope === s.id ? 'global-search__scope--active' : 'global-search__scope'}
                onClick={() => setScope(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="global-search__hint">
            {q.length > 1
              ? `Search "${q}" in ${SEARCH_SCOPES.find((s) => s.id === scope)?.label ?? 'All'} — backend integration coming soon.`
              : 'Type to search across suppliers, buyers, purchases, sales, and categories.'}
          </p>
        </div>
      )}
    </div>
  );
}
