'use client';

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  return (
    <div className="pagination-bar" role="navigation" aria-label="Pagination">
      <span className="pagination-bar__meta">
        {total === 0 ? 'No rows' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="pagination-bar__controls">
        {onPageSizeChange && (
          <select
            className="field-input field-input--compact"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
        <button
          className="btn btn--ghost btn--compact"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        <span className="pagination-bar__page">
          {page} / {totalPages}
        </span>
        <button
          className="btn btn--ghost btn--compact"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
