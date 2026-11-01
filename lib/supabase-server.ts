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
  paid: 'Confirmed',
  sent_to_printer: 'Printing',
  printed: 'Printed',
  pickup_requested: 'Pickup requested',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// The steps the customer sees on the order page. "paid" means the order is confirmed: the payment
// was checked, or it is cash on delivery. A confirmed order waits with the merchant until they start
// printing it. A pickup request still shows as "Printed".
export const JOURNEY = ['placed', 'payment', 'paid', 'sent_to_printer', 'printed', 'shipped', 'delivered'] as const;
export type JourneyStep = (typeof JOURNEY)[number];
export function journeyIndex(o: Pick<OrderRow, 'status' | 'status_times'>): number {
  if (o.status === 'cancelled') return -1;
  if (o.status === 'pending_payment') return o.status_times?.payment_claimed ? 1 : 0;
  return JOURNEY.indexOf(o.status === 'pickup_requested' ? 'printed' : o.status as JourneyStep);
}


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
  price: { lines?: { label: string; amount: number }[]; each?: number; subtotal: number; shipping: number; cod_fee?: number; total: number; cost?: number };
  total: number;
  files: Record<string, string>;
  payment_ref: string | null;
  printer_id: string | null;
  printer_cost: number | null;
  printer_note: string | null;
  tracking: string | null;
  notes: string | null;
  pickup_requested_at: string | null;
  // when the order first reached each status; payment_claimed is when the customer tapped I have paid
  status_times: Partial<Record<OrderStatus | 'payment_claimed', string>> | null;
  issue: OrderIssue | null;
  issue_note: string | null;
  refund_amount: number | null;
  shiprocket: ShipInfo | null; // the courier booking (iCarry); the column is named after the courier used before
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
  shiprocket_pickup: string | null; // the merchant's iCarry pickup address ID (column named after the courier used before)
}

// what the courier company gave back when the merchant requested a pickup
export interface ShipInfo {
  carrier?: 'icarry'; // missing on bookings made with Shiprocket before
  mode: 'test' | 'live';
  shipment_id?: number;
  awb?: string;
  courier?: string;
  tracking_url?: string;
  label_url?: string;
  status?: string; // the latest status iCarry sent
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
export function stampStatus(times: OrderRow['status_times'], status: OrderStatus | 'payment_claimed', at = new Date().toISOString()) {
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
