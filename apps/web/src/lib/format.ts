const TZ = 'Africa/Nairobi';

export const formatMoney = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatWeight = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('en-KE', { maximumFractionDigits: 3 })} kg`;
};

export const formatDate = (value: string | Date): string =>
  new Date(value).toLocaleString('en-KE', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });

export const isTodayEat = (value: string | Date): boolean => {
  const d = new Date(value);
  const now = new Date();
  const fmt = (x: Date) =>
    x.toLocaleDateString('en-CA', { timeZone: TZ });
  return fmt(d) === fmt(now);
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile_money_manual: 'Mobile money',
  other_manual: 'Other',
};

export const formatMethod = (method: string | null | undefined): string =>
  PAYMENT_METHOD_LABELS[method ?? ''] ?? (method ? method.replace(/_/g, ' ') : '—');

export const formatDayTime = (value: string | Date): string => {
  const d = new Date(value);
  const time = d.toLocaleTimeString('en-KE', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  if (isTodayEat(d)) return `Today ${time}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toLocaleDateString('en-CA', { timeZone: TZ }) ===
      yesterday.toLocaleDateString('en-CA', { timeZone: TZ })) {
    return `Yesterday ${time}`;
  }
  const day = d.toLocaleDateString('en-KE', { timeZone: TZ, day: 'numeric', month: 'short' });
  return `${day} ${time}`;
};

export const startOfWeekEat = (): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};
