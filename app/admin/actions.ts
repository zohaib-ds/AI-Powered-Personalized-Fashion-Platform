'use server';

import { revalidatePath } from 'next/cache';
import { hashPassword, newLoginId, newPassword } from '@/lib/printer-auth';
import { ISSUE_LABEL, stampStatus, STATUS_LABEL, supabaseAdmin, type OrderRow, type OrderStatus } from '@/lib/supabase-server';

// Only reachable from /admin, which middleware protects with ADMIN_PASSWORD.
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const text = (form: FormData, k: string, max: number) => String(form.get(k) || '').trim().slice(0, max) || null;

export async function updateOrder(form: FormData) {
  const id = String(form.get('id') || '');
  let status = String(form.get('status') || '') as OrderStatus;
  if (!isId(id) || !(status in STATUS_LABEL)) return;
  const printerId = String(form.get('printer_id') || '');
  const issue = String(form.get('issue') || '');
  const refund = Math.round(Number(form.get('refund_amount') || 0));
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('printer_id,status,status_times,total').eq('id', id).single();
  const before = data as Pick<OrderRow, 'printer_id' | 'status' | 'status_times' | 'total'> | null;
  if (!before) return;
  // handing a paid order to a printer moves it to "with the printer"
  if (printerId && before.printer_id !== printerId && status === 'paid') status = 'sent_to_printer';
  const now = new Date().toISOString();
  await db
    .from('orders')
    .update({
      status,
      printer_id: isId(printerId) ? printerId : null,
      tracking: text(form, 'tracking', 120),
      notes: text(form, 'notes', 1000),
      issue: issue in ISSUE_LABEL ? issue : null,
      issue_note: issue in ISSUE_LABEL ? text(form, 'issue_note', 1000) : null,
      refund_amount: issue === 'refund' || issue === 'return' ? Math.min(Math.max(0, refund), before.total) : null,
      status_times: stampStatus(before.status_times, status, now),
      updated_at: now,
    })
    .eq('id', id);
  revalidatePath('/admin');
}

export interface Credentials { name: string; loginId: string; password: string }
export type CredentialsResult = Credentials | { error: string } | null;

// Turns a database error into a line the admin can act on.
function saveError(e: { code?: string; message?: string }) {
  if (e.code === '42703' || e.code === 'PGRST204' || /column/i.test(e.message ?? '')) {
    return 'The database is missing the login columns. In Supabase, open SQL Editor, paste all of supabase/schema.sql and click Run, then try again.';
  }
  return `Could not save: ${e.message ?? 'unknown database error'}`;
}

// Adds a merchant and shows their login ID and password once. Only a hash of the password is stored.
export async function createPrinter(_prev: CredentialsResult, form: FormData): Promise<CredentialsResult> {
  const name = text(form, 'name', 120);
  if (!name) return { error: 'Type the merchant name first.' };
  const db = supabaseAdmin();
  let last: { code?: string; message?: string } = {};
  for (let tries = 0; tries < 5; tries++) {
    const loginId = newLoginId();
    const password = newPassword();
    const { error } = await db.from('printers').insert({
      name, area: text(form, 'area', 120), phone: text(form, 'phone', 20), access_code: loginId, login_id: loginId, password_hash: hashPassword(password),
    });
    if (!error) {
      revalidatePath('/admin');
      return { name, loginId, password };
    }
    last = error;
    // Only a clash with an existing login ID is worth another try.
    if (error.code !== '23505') break;
  }
  return { error: saveError(last) };
}

// Makes a new password for a merchant (and signs them out everywhere).
export async function resetPrinterPassword(_prev: CredentialsResult, form: FormData): Promise<CredentialsResult> {
  const id = String(form.get('id') || '');
  if (!isId(id)) return { error: 'Merchant not found.' };
  const db = supabaseAdmin();
  const { data, error: readError } = await db.from('printers').select('name,login_id,access_code').eq('id', id).single();
  if (readError) return { error: saveError(readError) };
  if (!data) return { error: 'Merchant not found.' };
  const loginId = data.login_id ?? data.access_code;
  const password = newPassword();
  const { error } = await db.from('printers').update({ password_hash: hashPassword(password), login_id: loginId }).eq('id', id);
  if (error) return { error: saveError(error) };
  revalidatePath('/admin');
  return { name: data.name, loginId, password };
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
