import 'server-only';
import { shirtName, zonesUsed } from './design';
import { addressText, orderItems, type OrderRow, type PrinterRow, type ShiprocketInfo } from './supabase-server';

// Shiprocket books the courier when a merchant taps Request pickup.
// Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD (an API user from Shiprocket > Settings > API) in Vercel.
// SHIPROCKET_MODE=live also books the courier and the pickup, which charges the Shiprocket wallet.
// Any other value (the default) only creates the order in Shiprocket, for testing.
const BASE = process.env.SHIPROCKET_API_URL || 'https://apiv2.shiprocket.in/v1/external'; // override only for local tests

export const shiprocketOn = () => !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
export const shiprocketMode = (): 'test' | 'live' => (process.env.SHIPROCKET_MODE === 'live' ? 'live' : 'test');

let cached: { token: string; until: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(`Shiprocket sign in failed: ${errorText(data, res.status)}`);
  // tokens last 10 days; sign in again after a day to be safe
  cached = { token: data.token, until: Date.now() + 24 * 3600 * 1000 };
  return data.token;
}

function errorText(data: { message?: string; errors?: Record<string, string[] | string> }, status: number): string {
  const details = Object.values(data?.errors ?? {}).flat().join(' ');
  return [data?.message, details].filter(Boolean).join(' ') || `HTTP ${status}`;
}

async function call<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorText(data, res.status));
  return data as T;
}

export const pickupName = (p: Pick<PrinterRow, 'shiprocket_pickup' | 'login_id' | 'access_code'>) =>
  p.shiprocket_pickup || p.login_id || p.access_code;

// Adds the merchant's shop as a pickup address in Shiprocket. Returns an error message, or null when it worked.
export async function addPickupAddress(p: PrinterRow): Promise<string | null> {
  if (!shiprocketOn()) return null;
  if (!p.address || !p.pincode || !p.phone) return 'Add the full address, pincode and phone first.';
  try {
    await call('/settings/company/addpickup', {
      pickup_location: pickupName(p),
      name: p.name,
      email: process.env.SHIPROCKET_EMAIL,
      phone: p.phone,
      address: p.address,
      address_2: '',
      city: p.city || 'Delhi',
      state: 'Delhi',
      country: 'India',
      pin_code: p.pincode,
    });
    return null;
  } catch (e) {
    const msg = (e as Error).message;
    return /already|exist/i.test(msg) ? null : msg;
  }
}

const istDate = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)}`;
};

// Sends one order to Shiprocket. In live mode it also picks a courier, books the pickup and makes the label.
// When an earlier try got part of the way (o.shiprocket), it carries on from there instead of starting again.
export async function bookShipment(o: OrderRow, p: PrinterRow): Promise<ShiprocketInfo> {
  const mode = shiprocketMode();
  const prev = o.shiprocket;
  const info: ShiprocketInfo = { mode, at: new Date().toISOString(), order_id: prev?.order_id, shipment_id: prev?.shipment_id, awb: prev?.awb, courier: prev?.courier, pickup_booked: prev?.pickup_booked, label_url: prev?.label_url };
  try {
    if (!info.shipment_id) await createOrder(o, p, info);
    if (mode !== 'live') return info;
    if (!info.awb) {
      const awb = await call<{ message?: string; response?: { data?: { awb_code?: string; courier_name?: string } } }>(
        '/courier/assign/awb', { shipment_id: info.shipment_id });
      const data = awb.response?.data;
      if (!data?.awb_code) throw new Error(awb.message || 'No courier could be assigned. Check the Shiprocket wallet balance.');
      info.awb = data.awb_code;
      info.courier = data.courier_name;
    }
    if (!info.pickup_booked) {
      await call('/courier/generate/pickup', { shipment_id: [info.shipment_id] });
      info.pickup_booked = true;
    }
    if (!info.label_url) {
      const label = await call<{ label_url?: string }>('/courier/generate/label', { shipment_id: [info.shipment_id] });
      if (label.label_url) info.label_url = label.label_url;
    }
    return info;
  } catch (e) {
    info.error = (e as Error).message.slice(0, 500);
    return info;
  }
}

async function createOrder(o: OrderRow, p: PrinterRow, info: ShiprocketInfo) {
  const items = orderItems(o);
  const shirts = Math.max(1, o.qty);
  const [first, ...rest] = o.customer_name.trim().split(/\s+/);
  const created = await call<{ order_id?: number; shipment_id?: number; message?: string }>('/orders/create/adhoc', {
    order_id: o.code ?? o.id.slice(0, 8).toUpperCase(),
    order_date: istDate(o.created_at),
    pickup_location: pickupName(p),
    billing_customer_name: first,
    billing_last_name: rest.join(' '),
    billing_address: addressText(o),
    billing_city: o.address_parts?.city || 'Delhi',
    billing_pincode: o.pincode,
    billing_state: 'Delhi',
    billing_country: 'India',
    billing_email: o.email || process.env.SHIPROCKET_EMAIL,
    billing_phone: o.phone,
    shipping_is_billing: true,
    order_items: items.map((it, i) => ({
      name: `${shirtName(it.colourId, it.size)}, ${it.label}`,
      sku: `WS-${it.colourId}-${it.size ?? 'free'}-${zonesUsed(it).length || 1}-${i + 1}`,
      units: it.qty,
      selling_price: it.each,
    })),
    payment_method: 'Prepaid',
    shipping_charges: o.price?.shipping ?? 0,
    sub_total: o.price?.subtotal ?? o.total,
    length: 30,
    breadth: 25,
    height: Math.min(30, 2 + 2 * shirts),
    weight: Math.round((0.1 + 0.2 * shirts) * 100) / 100,
  });
  if (!created.shipment_id) throw new Error(created.message || 'Shiprocket did not return a shipment.');
  info.order_id = created.order_id;
  info.shipment_id = created.shipment_id;
}
