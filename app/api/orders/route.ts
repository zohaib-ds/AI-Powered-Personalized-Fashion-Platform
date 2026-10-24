import { NextResponse } from 'next/server';
import { ADDRESS_FIELDS, COLOURS, FONTS, formatAddress, isDelhiPincode, isMobile, isSize, mobileDigits, shortId, ZONES, zonesUsed, type Address, type PrintSummary, type SizeId } from '@/lib/design';
import { PRICES, quoteOrder } from '@/lib/pricing';
import { PRINT_BUCKET, supabaseAdmin, type OrderItem } from '@/lib/supabase-server';

const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

interface CleanItem { colourId: string; size: SizeId; qty: number; prints: PrintSummary[] }

function cleanItem(raw: unknown): CleanItem | null {
  const d = raw as CleanItem;
  if (!d || typeof d !== 'object' || !Array.isArray(d.prints) || !d.prints.length || d.prints.length > 40) return null;
  if (!COLOURS.some((c) => c.id === d.colourId)) return null;
  if (d.size !== undefined && !isSize(d.size)) return null;
  const prints = d.prints.map((p): PrintSummary | null => {
    if (!p || !ZONES.includes(p.zone) || !['text', 'image', 'draw'].includes(p.type)) return null;
    if (!num(p.x, -40, 40) || !num(p.y, -40, 40) || !num(p.wCm, 0, 300) || !num(p.hCm, 0, 300) || !num(p.rot, -360, 360)) return null;
    const out: PrintSummary = { type: p.type, zone: p.zone, x: p.x, y: p.y, wCm: p.wCm, hCm: p.hCm, rot: p.rot };
    if (p.type === 'text') Object.assign(out, { text: str(p.text, 60), font: p.font && p.font in FONTS ? p.font : undefined, color: str(p.color, 20) });
    if (p.type === 'image' && num(p.dpi, 0, 100000)) out.dpi = p.dpi;
    return out;
  });
  if (prints.some((p) => !p)) return null;
  return { colourId: d.colourId, size: d.size ?? 'free', qty: Math.min(PRICES.maxQty, Math.max(1, Math.floor(Number(d.qty)) || 1)), prints: prints as PrintSummary[] };
}

export async function POST(req: Request) {
  let body: { items?: unknown; design?: unknown; customer?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const rawItems = Array.isArray(body.items) ? body.items : body.design ? [body.design] : [];
  if (!rawItems.length) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  if (rawItems.length > PRICES.maxItems) return NextResponse.json({ error: `You can order up to ${PRICES.maxItems} designs at once.` }, { status: 400 });
  const items = rawItems.map(cleanItem);
  if (items.some((i) => !i)) return NextResponse.json({ error: 'One of the designs could not be read. Remove it from the cart and add it again.' }, { status: 400 });
  const clean = items as CleanItem[];

  const c = body.customer ?? {};
  const raw = (c.address ?? {}) as Record<string, unknown>;
  const address = Object.fromEntries(ADDRESS_FIELDS.map((f) => [f.key, str(raw[f.key], f.max)])) as unknown as Address;
  address.pincode = address.pincode.replace(/\D/g, '');
  const customer = { name: str(c.name, 120), phone: mobileDigits(str(c.phone, 20)), email: str(c.email, 160) || null };
  if (!customer.name) return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
  if (!isMobile(customer.phone)) return NextResponse.json({ error: 'Enter a 10-digit mobile number.' }, { status: 400 });
  const missing = ADDRESS_FIELDS.find((f) => f.required && !address[f.key]);
  if (missing) return NextResponse.json({ error: `Please fill in: ${missing.label}.` }, { status: 400 });
  if (!isDelhiPincode(address.pincode)) {
    return NextResponse.json({ error: 'We deliver only in Delhi for now. Enter a pincode that starts with 110.' }, { status: 400 });
  }

  const q = quoteOrder(clean);
  let db;
  try {
    db = supabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  // signed upload links: per design, one 300 DPI PNG per print zone plus pictures of the shirt
  const id = crypto.randomUUID();
  const uploads: Record<string, { path: string; signedUrl: string }> = {};
  const orderItems: OrderItem[] = [];
  for (const [i, item] of clean.entries()) {
    const files: Record<string, string> = {};
    for (const key of [...zonesUsed(item), 'preview', 'views']) {
      const path = `${id}/${i + 1}/${key}.png`;
      const { data, error } = await db.storage.from(PRINT_BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error || !data) return NextResponse.json({ error: 'Could not prepare the file upload. Please try again.' }, { status: 500 });
      uploads[`${i}:${key}`] = { path, signedUrl: data.signedUrl };
      files[key] = path;
    }
    const iq = q.items[i];
    orderItems.push({ colourId: item.colourId, size: item.size, qty: iq.qty, prints: item.prints, files, label: iq.label, each: iq.each, cost: iq.cost });
  }

  const first = orderItems[0];
  const { error } = await db.from('orders').insert({
    id, code: shortId(id),
    customer_name: customer.name, phone: customer.phone, email: customer.email,
    address: formatAddress(address), address_parts: address, pincode: address.pincode,
    // the old single-design columns hold the first design so older screens still work
    colour_id: first.colourId, qty: q.shirts, design: { colourId: first.colourId, qty: first.qty, prints: first.prints }, files: first.files,
    items: orderItems,
    price: { subtotal: q.subtotal, shipping: q.shipping, total: q.total, cost: q.cost },
    total: q.total, printer_cost: q.cost,
  });
  if (error) return NextResponse.json({ error: 'Could not save the order. Please try again.' }, { status: 500 });

  return NextResponse.json({ orderId: id, total: q.total, uploads });
}
