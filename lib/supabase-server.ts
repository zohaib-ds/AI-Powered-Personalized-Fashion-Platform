import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DesignSummary } from './design';

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

export type OrderStatus = 'pending_payment' | 'paid' | 'sent_to_printer' | 'printed' | 'shipped' | 'delivered' | 'cancelled';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Waiting for payment',
  paid: 'Paid',
  sent_to_printer: 'With the printer',
  printed: 'Printed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// the customer-facing journey, in order
export const JOURNEY: OrderStatus[] = ['paid', 'sent_to_printer', 'printed', 'shipped', 'delivered'];

// what a printer may move an order to from the printer portal
export const PRINTER_STATUSES: OrderStatus[] = ['sent_to_printer', 'printed', 'shipped', 'delivered'];

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
  pincode: string;
  colour_id: string;
  qty: number;
  design: DesignSummary;
  price: { lines: { label: string; amount: number }[]; each: number; subtotal: number; shipping: number; total: number; cost?: number };
  total: number;
  files: Record<string, string>;
  payment_ref: string | null;
  printer_id: string | null;
  printer_cost: number | null;
  printer_note: string | null;
  tracking: string | null;
  notes: string | null;
}

export interface PrinterRow {
  id: string;
  created_at: string;
  name: string;
  area: string | null;
  phone: string | null;
  access_code: string;
  active: boolean;
}

export interface ReviewRow {
  id: string;
  created_at: string;
  order_id: string;
  rating: number;
  comment: string | null;
  name: string | null;
  show_on_site: boolean;
}

// signed download links (1 hour) for a batch of storage paths
export async function signedLinks(db: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  const links: Record<string, string> = {};
  if (!paths.length) return links;
  const { data } = await db.storage.from(PRINT_BUCKET).createSignedUrls(paths, 3600);
  for (const s of data ?? []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
  return links;
}
