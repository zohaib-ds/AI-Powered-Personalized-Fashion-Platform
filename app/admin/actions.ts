'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { STATUS_LABEL, supabaseAdmin, type OrderStatus } from '@/lib/supabase-server';

// Only reachable from /admin, which middleware protects with ADMIN_PASSWORD.
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const text = (form: FormData, k: string, max: number) => String(form.get(k) || '').trim().slice(0, max) || null;

export async function updateOrder(form: FormData) {
  const id = String(form.get('id') || '');
  let status = String(form.get('status') || '') as OrderStatus;
  if (!isId(id) || !(status in STATUS_LABEL)) return;
  const printerId = String(form.get('printer_id') || '');
  const db = supabaseAdmin();
  const { data: before } = await db.from('orders').select('printer_id,status').eq('id', id).single();
  // handing a paid order to a printer moves it to "with the printer"
  if (printerId && before && before.printer_id !== printerId && status === 'paid') status = 'sent_to_printer';
  await db
    .from('orders')
    .update({
      status,
      printer_id: isId(printerId) ? printerId : null,
      tracking: text(form, 'tracking', 120),
      notes: text(form, 'notes', 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  revalidatePath('/admin');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => 'WS-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export async function createPrinter(form: FormData) {
  const name = text(form, 'name', 120);
  if (!name) return;
  await supabaseAdmin().from('printers').insert({ name, area: text(form, 'area', 120), phone: text(form, 'phone', 20), access_code: newCode() });
  revalidatePath('/admin');
}

export async function setPrinterActive(form: FormData) {
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  await supabaseAdmin().from('printers').update({ active: form.get('active') === 'true' }).eq('id', id);
  revalidatePath('/admin');
}

export async function setReviewPublic(form: FormData) {
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  await supabaseAdmin().from('reviews').update({ show_on_site: form.get('show') === 'true' }).eq('id', id);
  revalidatePath('/admin');
  revalidatePath('/');
}
