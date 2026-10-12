import { NextResponse } from 'next/server';
import { COLOURS, isDelhiPincode, printedBox, type DesignSummary, type Side } from '@/lib/design';
import { quote } from '@/lib/pricing';
import { PRINT_BUCKET, supabaseAdmin } from '@/lib/supabase-server';

const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanDesign(raw: unknown): DesignSummary | null {
  const d = raw as DesignSummary;
  if (!d || typeof d !== 'object' || !Array.isArray(d.layers) || d.layers.length > 30) return null;
  if (!COLOURS.some((c) => c.id === d.colourId)) return null;
  const layers = d.layers.map((L) => {
    if (!L || (L.side !== 'front' && L.side !== 'back') || (L.type !== 'image' && L.type !== 'text')) return null;
    if (!num(L.x, -60, 60) || !num(L.y, -5, 80) || !num(L.w, 1, 40) || !num(L.aspect, 0.05, 40) || !num(L.rot, -360, 360)) return null;
    return {
      side: L.side, type: L.type, x: L.x, y: L.y, w: L.w, aspect: L.aspect, rot: L.rot,
      name: str(L.name, 120) || undefined, text: str(L.text, 60) || undefined, font: str(L.font, 40) || undefined, color: str(L.color, 20) || undefined,
    };
  });
  if (layers.some((l) => !l)) return null;
  return { colourId: d.colourId, heavy: !!d.heavy, qty: Math.min(10, Math.max(1, Math.floor(Number(d.qty)) || 1)), layers: layers as DesignSummary['layers'] };
}

export async function POST(req: Request) {
  let body: { design?: unknown; customer?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const design = cleanDesign(body.design);
  if (!design || !design.layers.length) return NextResponse.json({ error: 'Add at least one print to the shirt.' }, { status: 400 });

  const c = body.customer ?? {};
  const customer = {
    name: str(c.name, 120), phone: str(c.phone, 20), email: str(c.email, 160) || null,
    address: str(c.address, 600), pincode: str(c.pincode, 6),
  };
  if (!customer.name || !/^[0-9+ ]{10,14}$/.test(customer.phone) || !customer.address) {
    return NextResponse.json({ error: 'Please fill in your name, phone and address.' }, { status: 400 });
  }
  if (!isDelhiPincode(customer.pincode)) {
    return NextResponse.json({ error: 'We deliver in Delhi only for now (pincode starting with 110).' }, { status: 400 });
  }

  const q = quote(design);
  let db;
  try {
    db = supabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const { data: order, error } = await db
    .from('orders')
    .insert({
      customer_name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, pincode: customer.pincode,
      colour_id: design.colourId, heavy: design.heavy, qty: design.qty, design,
      price: { lines: q.lines, shipping: q.shipping, total: q.total }, total: q.total,
    })
    .select('id')
    .single();
  if (error || !order) return NextResponse.json({ error: 'Could not save the order. Please try again.' }, { status: 500 });

  // signed upload links for the print files the browser renders at 300 DPI
  const keys = (['front', 'back'] as Side[]).filter((s) => printedBox(design.layers, s)).concat('preview' as Side);
  const uploads: Record<string, { path: string; signedUrl: string }> = {};
  const files: Record<string, string> = {};
  for (const key of keys) {
    const path = `${order.id}/${key}.png`;
    const { data, error: upErr } = await db.storage.from(PRINT_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (upErr || !data) return NextResponse.json({ error: 'Could not prepare file upload.' }, { status: 500 });
    uploads[key] = { path, signedUrl: data.signedUrl };
    files[key] = path;
  }
  await db.from('orders').update({ files }).eq('id', order.id);

  return NextResponse.json({ orderId: order.id, total: q.total, uploads });
}
