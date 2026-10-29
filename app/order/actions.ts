'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin, type OrderStatus } from '@/lib/supabase-server';
import { mobileDigits } from '@/lib/design';

// Customers review from their own order page. The order link is the proof of purchase.
export async function submitReview(form: FormData) {
  const id = String(form.get('id') || '');
  const rating = Math.round(Number(form.get('rating')));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(rating >= 1 && rating <= 5)) return;
  const db = supabaseAdmin();
  const { data: order } = await db.from('orders').select('id,status,customer_name').eq('id', id).single();
  if (!order || !['printed', 'pickup_requested', 'shipped', 'delivered'].includes(order.status)) return;
  const comment = String(form.get('comment') || '').trim().slice(0, 800) || null;
  const first = String(order.customer_name || '').split(' ')[0];
  await db.from('reviews').upsert({ order_id: id, rating, comment, name: first || null }, { onConflict: 'order_id' });
  revalidatePath(`/order/${id}`);
}

// Find an order by its short code and the phone number used at checkout.
export async function trackOrder(_prev: string | null, form: FormData): Promise<string | null> {
  const code = String(form.get('code') || '').trim().replace(/^#/, '').toUpperCase();
  const digits = mobileDigits(String(form.get('phone') || ''));
  if (!/^[0-9A-F]{8}$/.test(code) || digits.length !== 10) return 'Enter the 8-character order number and the 10-digit mobile number you ordered with.';
  const { data } = await supabaseAdmin().from('orders').select('id,phone').eq('code', code).maybeSingle();
  if (!data || String(data.phone).replace(/\D/g, '').slice(-10) !== digits) return 'We could not find that order. Check the number on your order confirmation.';
  redirect(`/order/${data.id}`);
}

export interface MyOrder { id: string; code: string; state: string; total: number; createdAt: string }

const CUSTOMER_STATE: Record<OrderStatus, string> = {
  pending_payment: 'Waiting for payment',
  paid: 'Order placed',
  sent_to_printer: 'Printing',
  printed: 'Printed',
  pickup_requested: 'Printed',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// "My orders": the orders this browser placed. The order id works like the order page link, so it is the proof.
export async function myOrders(ids: string[]): Promise<MyOrder[]> {
  const want = (Array.isArray(ids) ? ids : []).filter((v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)).slice(0, 20);
  if (!want.length) return [];
  const { data } = await supabaseAdmin().from('orders').select('id,code,status,total,created_at').in('id', want).order('created_at', { ascending: false });
  return (data ?? []).map((o) => ({
    id: o.id, code: o.code ?? String(o.id).slice(0, 8).toUpperCase(), state: CUSTOMER_STATE[o.status as OrderStatus] ?? 'Order placed', total: o.total, createdAt: o.created_at,
  }));
}
