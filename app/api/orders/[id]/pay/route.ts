import { NextResponse } from 'next/server';
import { samplePay, upiOn } from '@/lib/payments';
import { stampStatus, supabaseAdmin } from '@/lib/supabase-server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  // with real UPI payments on, nobody may mark an order paid without the admin checking the money
  if (upiOn()) return NextResponse.json({ error: 'Pay by UPI on your order page.' }, { status: 403 });

  let db;
  try {
    db = supabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
  const { data: order } = await db.from('orders').select('id,status,status_times').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.status !== 'pending_payment') return NextResponse.json({ ok: true, status: order.status });

  const result = await samplePay(id);
  if (!result.ok) return NextResponse.json({ error: 'Payment failed.' }, { status: 402 });

  const { error } = await db.from('orders').update({ status: 'paid', payment_ref: result.reference, status_times: stampStatus(order.status_times, 'paid') }).eq('id', id).eq('status', 'pending_payment');
  if (error) return NextResponse.json({ error: 'Could not confirm payment.' }, { status: 500 });
  return NextResponse.json({ ok: true, status: 'paid' });
}
