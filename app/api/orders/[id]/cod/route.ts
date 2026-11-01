import { NextResponse } from 'next/server';
import { giveToMerchant } from '@/lib/auto-assign';
import { sendOrderMail } from '@/lib/mail';
import { COD_REF } from '@/lib/payments';
import { stampStatus, supabaseAdmin, type OrderRow } from '@/lib/supabase-server';

// Confirms a cash on delivery order once the checkout has uploaded its print files.
// The courier collects the money, so there is no payment to check.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  let db;
  try {
    db = supabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
  const { data } = await db.from('orders').select('*').eq('id', id).single();
  const o = data as OrderRow | null;
  if (!o || o.payment_ref !== COD_REF) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (o.status !== 'pending_payment') return NextResponse.json({ ok: true, status: o.status });
  const now = new Date().toISOString();
  const { data: moved, error } = await db.from('orders').update({ status: 'paid', updated_at: now, status_times: stampStatus(o.status_times, 'paid', now) })
    .eq('id', id).eq('status', 'pending_payment').select('id');
  if (error) return NextResponse.json({ error: 'Could not confirm the order. Please try again.' }, { status: 500 });
  if (moved?.length) {
    await giveToMerchant(id);
    await sendOrderMail('cod', o);
  }
  return NextResponse.json({ ok: true, status: 'paid' });
}
