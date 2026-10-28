import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { formatAddress, type Address, type DesignSummary, type PrintSummary, type SizeId } from './design';

export const PRINT_BUCKET = 'print-files';

let client: SupabaseClient | null = null;

// Server-side client with the secret (service role) key. Never import this from a client component.
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'sent_to_printer' | 'printed' | 'pickup_requested' | 'shipped' | 'delivered' | 'cancelled';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Waiting for payment',
  paid: 'Paid',
  sent_to_printer: 'With the printer',
  printed: 'Printed',
  pickup_requested: 'Pickup requested',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// the customer-facing journey, in order. A pickup request still shows as "Printed" to the customer.
export const JOURNEY: OrderStatus[] = ['paid', 'sent_to_printer', 'printed', 'shipped', 'delivered'];
export const journeyIndex = (s: OrderStatus) => JOURNEY.indexOf(s === 'pickup_requested' ? 'printed' : s);


// After-sale problems the admin records on an order.
export type OrderIssue = 'reprint' | 'refund' | 'return';
export const ISSUE_LABEL: Record<OrderIssue, string> = { reprint: 'Reprint', refund: 'Refund', return: 'Return' };

// One design in an order: its shirt colour, how many, the prints and the uploaded files.
export interface OrderItem {
  colourId: string;
  size?: SizeId; // missing on orders from before sizes: free size
  qty: number;
  prints: PrintSummary[];
  files: Record<string, string>; // zone → 300 DPI PNG, plus preview and views
  label: string;
  each: number;
  cost: number;
}

export interface OrderRow {
  id: string;
  code: string | null;
  created_at: string;
  updated_at: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  email: string | null;
  address: string;
  address_parts: Address | null;
  pincode: string;
  colour_id: string;
  qty: number;
  design: DesignSummary;
  items: OrderItem[] | null;
  price: { lines?: { label: string; amount: number }[]; each?: number; subtotal: number; shipping: number; total: number; cost?: number };
  total: number;
  files: Record<string, string>;
  payment_ref: string | null;
  printer_id: string | null;
  printer_cost: number | null;
  printer_note: string | null;
  tracking: string | null;
  notes: string | null;
  pickup_requested_at: string | null;
  status_times: Partial<Record<OrderStatus, string>> | null;
  issue: OrderIssue | null;
  issue_note: string | null;
  refund_amount: number | null;
  shiprocket: ShiprocketInfo | null;
}

// Orders placed before the cart have one design in the old columns. This gives every order the same shape.
export function orderItems(o: OrderRow): OrderItem[] {
  if (Array.isArray(o.items) && o.items.length) return o.items;
  const lines = o.price?.lines ?? [];
  return [{
    colourId: o.colour_id,
    qty: o.qty,
    prints: o.design?.prints ?? [],
    files: o.files ?? {},
    label: lines[0]?.label ?? 'Shirt',
    each: o.price?.each ?? 0,
    cost: o.qty ? Math.round((o.printer_cost ?? 0) / o.qty) : 0,
  }];
}

// first picture of the order, for lists
export const orderPreview = (o: OrderRow) => orderItems(o)[0]?.files.preview;

// the address as lines for a shipping label
export const addressText = (o: OrderRow) => (o.address_parts ? formatAddress(o.address_parts) : o.address);

export interface PrinterRow {
  id: string;
  created_at: string;
  name: string;
  area: string | null;
  phone: string | null;
  access_code: string;
  login_id: string | null;
  password_hash: string | null;
  password_enc?: string | null; // locked copy so the admin can see it (lib/printer-auth.ts)
  active: boolean;
  // pickup address and where to send their money, filled in by the merchant under Account
  address: string | null;
  city: string | null;
  pincode: string | null;
  account_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  upi_id: string | null;
  shiprocket_pickup: string | null; // the pickup location name in Shiprocket
}

// what Shiprocket gave back when the merchant requested a pickup
export interface ShiprocketInfo {
  mode: 'test' | 'live';
  order_id?: number;
  shipment_id?: number;
  awb?: string;
  courier?: string;
  label_url?: string;
  pickup_booked?: boolean;
  error?: string;
  at: string;
}

export interface PayoutRow {
  id: string;
  created_at: string;
  printer_id: string | null;
  printer_name: string;
  amount: number;
  pay_to: string | null;
  status: 'requested' | 'paid' | 'rejected';
  reference: string | null;
  paid_at: string | null;
}

// where a merchant's money goes, as one line
export const payTo = (p: Pick<PrinterRow, 'account_name' | 'account_number' | 'ifsc' | 'upi_id'>) =>
  [p.upi_id && `UPI ${p.upi_id}`, p.account_number && `A/c ${p.account_number}, IFSC ${p.ifsc ?? ''}${p.account_name ? `, ${p.account_name}` : ''}`].filter(Boolean).join(' or ') || null;

export interface ReviewRow {
  id: string;
  created_at: string;
  order_id: string;
  rating: number;
  comment: string | null;
  name: string | null;
  show_on_site: boolean;
}

// remember when an order first reached each status, for the analysis pages
export function stampStatus(times: OrderRow['status_times'], status: OrderStatus, at = new Date().toISOString()) {
  const t = { ...(times ?? {}) };
  t[status] ??= at;
  return t;
}

// signed download links (1 hour) for a batch of storage paths
export async function signedLinks(db: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  const links: Record<string, string> = {};
  if (!paths.length) return links;
  const { data } = await db.storage.from(PRINT_BUCKET).createSignedUrls(paths, 3600);
  for (const s of data ?? []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
  return links;
}
