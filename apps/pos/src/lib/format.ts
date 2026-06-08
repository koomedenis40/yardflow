/** Display-only formatting utilities. No business logic — do not use for calculations. */

export function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (isNaN(n)) return 'KES —';
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatWeight(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (isNaN(n)) return '— kg';
  return `${n.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function formatDayTime(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

export function formatMethod(method: string | null | undefined): string {
  if (!method) return '—';
  switch (method) {
    case 'cash': return 'Cash';
    case 'bank': return 'Bank';
    case 'mobile_money_manual': return 'Mobile money (manual)';
    case 'other_manual': return 'Other';
    default: return method;
  }
}

export function isTodayEat(iso: string): boolean {
  try {
    return new Date(iso).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

export function parseNumber(value: string): number {
  const n = parseFloat(value.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
