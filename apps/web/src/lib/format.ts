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

export const startOfWeekEat = (): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};
