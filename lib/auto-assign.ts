import 'server-only';
import { stampStatus, supabaseAdmin, type OrderRow } from './supabase-server';

// While only one merchant is switched on, every paid order goes straight to them, so nobody has to
// tap "Give" in the admin. With two or more, paid orders wait in To do > Give to a merchant as before.
// ₹1 payment tests are never sent, so nothing gets printed for them.
export async function giveToOnlyMerchant(id: string) {
  const db = supabaseAdmin();
  const { data: ps } = await db.from('printers').select('id').eq('active', true).limit(2);
  if (!ps || ps.length !== 1) return;
  const { data } = await db.from('orders').select('status,status_times,printer_id,items').eq('id', id).single();
  const o = data as Pick<OrderRow, 'status' | 'status_times' | 'printer_id' | 'items'> | null;
  if (!o || o.status !== 'paid' || o.printer_id) return;
  if ((o.items ?? []).some((it) => it.size === 'test')) return;
  const now = new Date().toISOString();
  await db.from('orders')
    .update({ printer_id: ps[0].id, status: 'sent_to_printer', status_times: stampStatus(o.status_times, 'sent_to_printer', now), updated_at: now })
    .eq('id', id).eq('status', 'paid');
}
