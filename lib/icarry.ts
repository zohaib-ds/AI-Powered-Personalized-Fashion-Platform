import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { shirtName } from './design';
import { COD_REF } from './payments';
import { addressText, orderItems, supabaseAdmin, type OrderRow, type PrinterRow, type ShipInfo } from './supabase-server';

// iCarry books the courier when the merchant taps "Printing done, request pickup".
// Set ICARRY_USERNAME and ICARRY_API_KEY (iCarry > Account > Integrations > API Credentials) in Vercel.
// ICARRY_MODE=live books the courier, which charges the iCarry wallet. Any other value (the default)
// only saves the shipment in iCarry without booking, for testing.
// API document: https://www.icarry.in/icarry-api.pdf
const BASE = process.env.ICARRY_API_URL || 'https://www.icarry.in'; // override only for local tests
const DELHI = { zoneId: '1483', state: 'DE' }; // iCarry's codes for Delhi, the only delivery area for now

export const icarryOn = () => !!(process.env.ICARRY_USERNAME && process.env.ICARRY_API_KEY);
export const icarryMode = (): 'test' | 'live' => (process.env.ICARRY_MODE === 'live' ? 'live' : 'test');

let cached: { token: string; until: number } | null = null;

// iCarry takes form fields, with nested ones written like consignee[name]
function form(data: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function post<T = Record<string, unknown>>(route: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: form(data),
    cache: 'no-store',
  });
  const text = await res.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { throw new Error(`iCarry answered with something unexpected (HTTP ${res.status}).`); }
  if (!res.ok || (body.error && body.error !== '')) throw new Error(errorText(body.error) || `HTTP ${res.status}`);
  return body as T;
}

function errorText(e: unknown): string {
  if (!e) return '';
  if (typeof e === 'string') return e;
  if (typeof e === 'object') return Object.values(e as Record<string, unknown>).map(errorText).filter(Boolean).join(' ');
  return String(e);
}

async function token(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const r = await post<{ api_token?: string }>('api_login', { username: process.env.ICARRY_USERNAME, key: process.env.ICARRY_API_KEY });
  if (!r.api_token) throw new Error('iCarry sign in failed. Check ICARRY_USERNAME and ICARRY_API_KEY.');
  // a token lasts 60 minutes
  cached = { token: r.api_token, until: Date.now() + 50 * 60 * 1000 };
  return r.api_token;
}

const call = async <T = Record<string, unknown>>(route: string, data: Record<string, unknown>) =>
  post<T>(`${route}&api_token=${encodeURIComponent(await token())}`, data);

// The merchant's iCarry pickup address ID, kept in printers.shiprocket_pickup (the column from before iCarry).
export const pickupId = (p: Pick<PrinterRow, 'shiprocket_pickup'>) => (/^\d+$/.test(p.shiprocket_pickup ?? '') ? Number(p.shiprocket_pickup) : null);

// Adds the merchant's shop as a pickup address in iCarry and returns its ID.
export async function addPickupAddress(p: PrinterRow): Promise<{ id: number } | { error: string }> {
  if (!p.address || !p.pincode || !p.phone) return { error: 'Add the full address, pincode and phone first.' };
  try {
    const r = await call<{ warehouse_id?: number | string }>('api_add_pickup_address', {
      nickname: (p.name.replace(/[^A-Za-z]/g, '') || 'WearSketch').slice(0, 30),
      name: p.name,
      email: process.env.ICARRY_EMAIL || 'wearsketchh@gmail.com',
      phone: p.phone,
      street1: p.address,
      city: p.city || 'Delhi',
      pincode: p.pincode,
      zone_id: DELHI.zoneId,
      country_id: '99',
    });
    const id = Number(r.warehouse_id);
    return id ? { id } : { error: 'iCarry did not return a pickup address ID.' };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 300) };
  }
}

// Adds the merchant's address to iCarry and keeps the new pickup address ID. Returns an error message, or null.
export async function registerPickup(p: PrinterRow): Promise<string | null> {
  const r = await addPickupAddress(p);
  if ('error' in r) return r.error;
  await supabaseAdmin().from('printers').update({ shiprocket_pickup: String(r.id) }).eq('id', p.id);
  p.shiprocket_pickup = String(r.id);
  return null;
}

// Books one order with iCarry. In test mode the shipment is only saved, not booked.
// An earlier try that already got a shipment carries on from there instead of booking twice.
export async function bookShipment(o: OrderRow, p: PrinterRow): Promise<ShipInfo> {
  const mode = icarryMode();
  const prev = o.shiprocket;
  const info: ShipInfo = { carrier: 'icarry', mode, at: new Date().toISOString(), shipment_id: prev?.shipment_id, awb: prev?.awb, courier: prev?.courier, tracking_url: prev?.tracking_url, label_url: prev?.label_url };
  try {
    // the first booking adds the merchant's address to iCarry if that has not happened yet
    if (!pickupId(p)) {
      const problem = await registerPickup(p);
      if (problem) throw new Error(`Could not add ${p.name}'s pickup address to iCarry: ${problem}`);
    }
    const pickup = pickupId(p)!;
    if (!info.shipment_id) {
      const items = orderItems(o);
      const shirts = Math.max(1, o.qty);
      const cod = o.payment_ref === COD_REF;
      const r = await call<{ shipment_id?: number; awb?: string; courier_name?: string; tracking_url?: string }>('api_add_shipment_surface', {
        pickup_address_id: pickup,
        client_order_id: o.code ?? o.id.slice(0, 8).toUpperCase(),
        ...(mode === 'live' ? {} : { save_only: 1 }),
        consignee: {
          name: o.customer_name,
          mobile: o.phone.replace(/\D/g, '').slice(-10),
          email: o.email ?? undefined,
          address: addressText(o).slice(0, 250),
          city: o.address_parts?.city || 'Delhi',
          pincode: o.pincode,
          state: DELHI.state,
          country_code: 'IN',
        },
        parcel: {
          type: cod ? 'COD' : 'Prepaid',
          value: o.total,
          currency: 'INR',
          contents: items.map((it) => `${shirtName(it.colourId, it.size)} x${it.qty}`).join(', ').slice(0, 250) || 'Printed T-shirts',
          dimensions: { length: 30, breadth: 25, height: Math.min(30, 2 + 2 * shirts), unit: 'cm' },
          weight: { weight: Math.round(100 + 200 * shirts), unit: 'gm' },
        },
      });
      if (!r.shipment_id) throw new Error('iCarry did not return a shipment.');
      Object.assign(info, { shipment_id: r.shipment_id, awb: r.awb || undefined, courier: r.courier_name || undefined, tracking_url: r.tracking_url || undefined });
    }
    if (mode === 'live' && info.awb && !info.label_url) {
      const l = await call<{ shipment_label?: { url?: string; type?: string }[] }>('api_print_shipment_label', { shipment_id: info.shipment_id, paper_size: 'A4' });
      const label = l.shipment_label?.find((x) => x.type === 'pdf') ?? l.shipment_label?.[0];
      if (label?.url) info.label_url = label.url;
    }
    return info;
  } catch (e) {
    info.error = (e as Error).message.slice(0, 500);
    return info;
  }
}

// iCarry's status codes, from its status callback
export const ICARRY_STATUS: Record<number, string> = {
  1: 'Pending pickup', 2: 'Processing', 3: 'Shipped', 7: 'Cancelled', 12: 'Damaged', 14: 'Lost', 16: 'Voided',
  21: 'Delivered', 22: 'In transit', 23: 'Returned to us', 24: 'Manifested', 25: 'Pickup scheduled', 26: 'Out for delivery', 27: 'Pending return',
};

// iCarry signs its callbacks with our own API key
export function callbackTokenOk(token: string): boolean {
  const key = process.env.ICARRY_API_KEY ?? '';
  const a = Buffer.from(token), b = Buffer.from(key);
  return !!key && a.length === b.length && timingSafeEqual(a, b);
}
