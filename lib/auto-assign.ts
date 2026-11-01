import 'server-only';
import { supabaseAdmin, type OrderRow } from './supabase-server';

// There is one merchant for now, so every confirmed order goes straight to them: the first merchant
// that is switched on (the oldest, if there are ever more). The order stays "Confirmed" and shows
// under New orders on their page until they tap Start printing.
// ₹1 payment tests are never sent, so nothing gets printed for them.
export async function giveToMerchant(id: string) {
  const db = supabaseAdmin();
  const { data: ps } = await db.from('printers').select('id').eq('active', true).order('created_at', { ascending: true }).limit(1);
  if (!ps?.length) return;
  const { data } = await db.from('orders').select('status,printer_id,items').eq('id', id).single();
  const o = data as Pick<OrderRow, 'status' | 'printer_id' | 'items'> | null;
  if (!o || o.status !== 'paid' || o.printer_id) return;
  if ((o.items ?? []).some((it) => it.size === 'test')) return;
  await db.from('orders').update({ printer_id: ps[0].id, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'paid').is('printer_id', null);
}
