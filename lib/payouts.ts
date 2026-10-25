import type { OrderRow, PayoutRow } from './supabase-server';

// Merchants can ask for their money once every few days. They earn their rate on delivered orders.
export const WITHDRAW_EVERY_DAYS = 5;
const DAY = 24 * 3600 * 1000;

export function merchantMoney(orders: Pick<OrderRow, 'status' | 'printer_cost'>[], payouts: Pick<PayoutRow, 'amount' | 'status' | 'created_at'>[], now = Date.now()) {
  const earned = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.printer_cost ?? 0), 0);
  const live = payouts.filter((p) => p.status !== 'rejected');
  const withdrawn = live.reduce((s, p) => s + p.amount, 0);
  const paid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const last = live.reduce((t, p) => Math.max(t, new Date(p.created_at).getTime()), 0);
  const nextAt = last ? last + WITHDRAW_EVERY_DAYS * DAY : 0;
  return { earned, withdrawn, paid, available: Math.max(0, earned - withdrawn), nextAt, canNow: nextAt <= now };
}
