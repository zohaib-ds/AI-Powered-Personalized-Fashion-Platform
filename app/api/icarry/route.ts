import { NextResponse } from 'next/server';
import { callbackTokenOk, ICARRY_STATUS } from '@/lib/icarry';
import { stampStatus, supabaseAdmin, type OrderRow } from '@/lib/supabase-server';

// iCarry's status callback. In iCarry: Account > Integrations > API Credentials, set the callback URL
// to https://<your site>/api/icarry. Shipped and delivered move the order on by themselves.
const SHIPPED = new Set([3, 22, 26]); // shipped, in transit, out for delivery
const DELIVERED = 21;

export async function POST(req: Request) {
  const type = req.headers.get('content-type') ?? '';
  let body: Record<string, unknown> = {};
  try {
    body = type.includes('json') ? await req.json() : Object.fromEntries(await req.formData());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!callbackTokenOk(String(body.token ?? ''))) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });
  const code = Number(body.status);
  const shipmentId = Number(body.shipment_id);
  const ref = String(body.client_order_id ?? '').trim().toUpperCase();
  const db = supabaseAdmin();
  // we send our order code as client_order_id; fall back to the shipment ID
  let o: OrderRow | null = null;
  if (/^[0-9A-F]{8}$/.test(ref)) o = (await db.from('orders').select('*').eq('code', ref).maybeSingle()).data as OrderRow | null;
  if (!o && shipmentId) o = (await db.from('orders').select('*').eq('shiprocket->>shipment_id', String(shipmentId)).maybeSingle()).data as OrderRow | null;
  if (!o) return NextResponse.json({ ok: true, note: 'No matching order.' });

  const now = new Date().toISOString();
  const info = { ...(o.shiprocket ?? { mode: 'live' as const, at: now }), status: ICARRY_STATUS[code] ?? `Status ${code}`, ...(body.awb ? { awb: String(body.awb) } : {}) };
  let status = o.status;
  if (SHIPPED.has(code) && ['sent_to_printer', 'printed', 'pickup_requested'].includes(o.status)) status = 'shipped';
  if (code === DELIVERED && o.status !== 'cancelled') status = 'delivered';
  let times = o.status_times;
  if (status === 'shipped' || status === 'delivered') times = stampStatus(times, 'shipped', now);
  if (status === 'delivered') times = stampStatus(times, 'delivered', now);
  await db.from('orders').update({
    status, shiprocket: info, status_times: times, updated_at: now,
    ...(info.awb && !o.tracking ? { tracking: info.awb } : {}),
  }).eq('id', o.id);
  return NextResponse.json({ ok: true });
}
