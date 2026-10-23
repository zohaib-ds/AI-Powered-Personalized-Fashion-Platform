'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-server';
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
