import { NextResponse } from 'next/server';
import { COLOURS, FONTS, isDelhiPincode, shortId, ZONES, type DesignSummary, type PrintSummary } from '@/lib/design';
import { quote } from '@/lib/pricing';
import { PRINT_BUCKET, supabaseAdmin } from '@/lib/supabase-server';

const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanDesign(raw: unknown): DesignSummary | null {
  const d = raw as DesignSummary;
  if (!d || typeof d !== 'object' || !Array.isArray(d.prints) || d.prints.length > 40) return null;
  if (!COLOURS.some((c) => c.id === d.colourId)) return null;
  const prints = d.prints.map((p): PrintSummary | null => {
    if (!p || !ZONES.includes(p.zone) || !['text', 'image', 'draw'].includes(p.type)) return null;
    if (!num(p.x, -40, 40) || !num(p.y, -40, 40) || !num(p.wCm, 0, 300) || !num(p.hCm, 0, 300) || !num(p.rot, -360, 360)) return null;
    const out: PrintSummary = { type: p.type, zone: p.zone, x: p.x, y: p.y, wCm: p.wCm, hCm: p.hCm, rot: p.rot };
    if (p.type === 'text') Object.assign(out, { text: str(p.text, 60), font: p.font && p.font in FONTS ? p.font : undefined, color: str(p.color, 20) });
    if (p.type === 'image' && num(p.dpi, 0, 100000)) out.dpi = p.dpi;
    return out;
  });
  if (prints.some((p) => !p)) return null;
  return { colourId: d.colourId, qty: Math.min(10, Math.max(1, Math.floor(Number(d.qty)) || 1)), prints: prints as PrintSummary[] };
}

export async function POST(req: Request) {
  let body: { design?: unknown; customer?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const design = cleanDesign(body.design);
  if (!design || !design.prints.length) return NextResponse.json({ error: 'Add at least one print to the shirt.' }, { status: 400 });

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

  const id = crypto.randomUUID();
  const { error } = await db.from('orders').insert({
    id, code: shortId(id),
    customer_name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, pincode: customer.pincode,
    colour_id: design.colourId, qty: design.qty, design,
    price: { lines: q.lines, each: q.each, subtotal: q.subtotal, shipping: q.shipping, total: q.total, cost: q.cost },
    total: q.total, printer_cost: q.cost * q.qty,
  });
  if (error) return NextResponse.json({ error: 'Could not save the order. Please try again.' }, { status: 500 });

  // signed upload links: one 300 DPI PNG per print zone, plus pictures of the shirt
  const keys = [...ZONES.filter((z) => design.prints.some((p) => p.zone === z)), 'preview', 'views'];
  const uploads: Record<string, { path: string; signedUrl: string }> = {};
  const files: Record<string, string> = {};
  for (const key of keys) {
    const path = `${id}/${key}.png`;
    const { data, error: upErr } = await db.storage.from(PRINT_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (upErr || !data) return NextResponse.json({ error: 'Could not prepare file upload.' }, { status: 500 });
    uploads[key] = { path, signedUrl: data.signedUrl };
    files[key] = path;
  }
  await db.from('orders').update({ files }).eq('id', id);

  return NextResponse.json({ orderId: id, total: q.total, uploads });
}
