'use server';

import { revalidatePath } from 'next/cache';
import { isUtr, upiOn, UTR_MISSING, UTR_SENT } from '@/lib/payments';
import { supabaseAdmin, type OrderRow } from '@/lib/supabase-server';

// The customer paid by UPI. The 12 digit UPI reference (UTR) is optional: without it the admin
// matches the payment by its amount and the order number in the UPI note.
export async function sendUtr(_prev: string | null, form: FormData): Promise<string | null> {
  if (!upiOn()) return 'UPI payment is not switched on yet.';
  const id = String(form.get('id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return 'Order not found.';
  const utr = String(form.get('utr') || '').replace(/\D/g, '');
  if (utr && !isUtr(utr)) return 'The UPI reference number is 12 digits, only numbers, like 412345678901. Check it, or leave the box empty.';

  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('status,payment_ref').eq('id', id).maybeSingle();
  const o = data as Pick<OrderRow, 'status' | 'payment_ref'> | null;
  if (!o) return 'Order not found.';
  if (o.status !== 'pending_payment' || o.payment_ref?.startsWith(UTR_SENT)) return null;
  // once we could not find the payment, we need the number to look again
  if (!utr && o.payment_ref?.startsWith(UTR_MISSING)) return 'Enter the 12 digit UPI reference number from your UPI app. It is only numbers, like 412345678901.';
  // one payment can only pay for one order
  if (utr) {
    const { data: used } = await db.from('orders').select('id').eq('payment_ref', UTR_SENT + utr).limit(2);
    if ((used ?? []).some((u: { id: string }) => u.id !== id)) return 'That reference number is already used for another order. Check it in your UPI app.';
  }

  const { error } = await db.from('orders')
    .update({ payment_ref: UTR_SENT + utr, updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending_payment');
  if (error) return 'Could not save it. Please try again.';
  revalidatePath(`/order/${id}`);
  revalidatePath('/admin');
  return null;
}
