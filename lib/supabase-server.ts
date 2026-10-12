import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const PRINT_BUCKET = 'print-files';

let client: SupabaseClient | null = null;

// Server-side client with the service role key. Never import this from a client component.
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
  sent_to_printer: 'Sent to printer',
  printed: 'Printed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export interface OrderRow {
  id: string;
  created_at: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  email: string | null;
  address: string;
  pincode: string;
  colour_id: string;
  heavy: boolean;
  qty: number;
  design: unknown;
  price: { lines: { label: string; amount: number }[]; total: number; shipping: number };
  total: number;
  files: Record<string, string>;
  payment_ref: string | null;
  printer: string | null;
  tracking: string | null;
  notes: string | null;
}
