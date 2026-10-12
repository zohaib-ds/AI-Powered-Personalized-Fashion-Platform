'use server';

import { revalidatePath } from 'next/cache';
import { STATUS_LABEL, supabaseAdmin, type OrderStatus } from '@/lib/supabase-server';

// Only reachable from /admin, which middleware protects with ADMIN_PASSWORD.
export async function updateOrder(form: FormData) {
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '') as OrderStatus;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(status in STATUS_LABEL)) return;
  await supabaseAdmin()
    .from('orders')
    .update({
      status,
      printer: String(form.get('printer') || '').slice(0, 120) || null,
      tracking: String(form.get('tracking') || '').slice(0, 120) || null,
      notes: String(form.get('notes') || '').slice(0, 1000) || null,
    })
    .eq('id', id);
  revalidatePath('/admin');
}
