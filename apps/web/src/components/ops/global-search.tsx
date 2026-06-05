'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { SEARCH_SCOPES, type SearchScope } from '@/lib/search-types';

export function GlobalSearch({ tenantSlug }: { tenantSlug: string }) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="global-search" data-tenant={tenantSlug}>
      <div className="global-search__wrap">
        <Icon icon={Search} size={16} className="global-search__icon" />
        <input
          ref={inputRef}
          className="global-search__input"
          placeholder="Search operations…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Global search"
        />
      </div>
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
      {q.length > 1 && (
        <p className="global-search__hint">Search API integration coming soon — UI ready.</p>
      )}
    </div>
  );
}
