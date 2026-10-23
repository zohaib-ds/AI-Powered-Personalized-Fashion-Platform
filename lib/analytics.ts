import type { OrderRow } from './supabase-server';

// Week buckets in India time, Monday to Sunday, newest first.
const IST = 5.5 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;

export function weekStart(iso: string): number {
  const t = new Date(iso).getTime() + IST;
  const d = Math.floor(t / DAY);
  const weekday = (new Date(d * DAY).getUTCDay() + 6) % 7; // Monday = 0
  return (d - weekday) * DAY;
}

export const weekLabel = (start: number) =>
  new Date(start).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' });

export interface WeekRow { start: number; orders: number; shirts: number; revenue: number; cost: number }

export function weekly(orders: OrderRow[], weeks = 8, now = new Date().toISOString()): WeekRow[] {
  const latest = weekStart(now);
  const rows: WeekRow[] = Array.from({ length: weeks }, (_, i) => ({ start: latest - i * 7 * DAY, orders: 0, shirts: 0, revenue: 0, cost: 0 }));
  for (const o of orders) {
    const r = rows.find((x) => x.start === weekStart(o.created_at));
    if (!r) continue;
    r.orders += 1;
    r.shirts += o.qty;
    r.revenue += o.total;
    r.cost += o.printer_cost ?? 0;
  }
  return rows;
}

// hours between two moments, or null
export const hoursBetween = (a?: string, b?: string) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 3600000 : null);

export function average(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x) && x >= 0);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export function formatHours(h: number | null): string {
  if (h === null) return 'Not enough data';
  if (h < 1) return 'Under an hour';
  if (h < 48) return Math.round(h) === 1 ? '1 hour' : `${Math.round(h)} hours`;
  return `${(h / 24).toFixed(1)} days`;
}
