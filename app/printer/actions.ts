'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPassword, currentPrinter, endPrinterSession, startPrinterSession } from '@/lib/printer-auth';
import { PRINTER_STATUSES, stampStatus, supabaseAdmin, type OrderRow, type OrderStatus, type PrinterRow } from '@/lib/supabase-server';

const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function printerLogin(_prev: string | null, form: FormData): Promise<string | null> {
  const loginId = String(form.get('login_id') || '').trim().toUpperCase();
  const password = String(form.get('password') || '');
  if (!loginId || !password) return 'Enter your login ID and password.';
  const { data } = await supabaseAdmin().from('printers').select('id,password_hash').eq('login_id', loginId).eq('active', true).maybeSingle();
  const p = data as Pick<PrinterRow, 'id' | 'password_hash'> | null;
  if (!p || !checkPassword(password, p.password_hash)) return 'That login ID and password did not match. Check them with the WearSketch team.';
  await startPrinterSession(p);
  redirect('/printer');
}

export async function printerLogout() {
  await endPrinterSession();
  redirect('/printer');
}

async function ownOrder(id: string, printerId: string) {
  const { data } = await supabaseAdmin().from('orders').select('id,status,status_times').eq('id', id).eq('printer_id', printerId).maybeSingle();
  return data as Pick<OrderRow, 'id' | 'status' | 'status_times'> | null;
}

// A merchant moves their own order along: printing, printed, pickup requested, shipped (with tracking), delivered.
export async function printerUpdate(form: FormData) {
  const printer = await currentPrinter();
  if (!printer) redirect('/printer');
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '') as OrderStatus;
  if (!isId(id) || !PRINTER_STATUSES.includes(status)) return;
  const order = await ownOrder(id, printer.id);
  if (!order || order.status === 'cancelled') return;
  const tracking = String(form.get('tracking') || '').trim().slice(0, 120) || null;
  const note = String(form.get('printer_note') || '').trim().slice(0, 1000) || null;
  const now = new Date().toISOString();
  await supabaseAdmin()
    .from('orders')
    .update({
      status, tracking, printer_note: note, updated_at: now, status_times: stampStatus(order.status_times, status, now),
      ...(status === 'pickup_requested' && order.status !== 'pickup_requested' ? { pickup_requested_at: now } : {}),
    })
    .eq('id', id)
    .eq('printer_id', printer.id);
  revalidatePath('/printer');
  revalidatePath(`/printer/orders/${id}`);
}

// "Request pickup": marks a printed order as ready to be collected. The WearSketch team sees
// the request in /admin and books the courier.
export async function requestPickup(form: FormData) {
  const printer = await currentPrinter();
  if (!printer) redirect('/printer');
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const order = await ownOrder(id, printer.id);
  if (!order || !['sent_to_printer', 'printed'].includes(order.status)) return;
  const now = new Date().toISOString();
  let times = stampStatus(order.status_times, 'printed', now);
  times = stampStatus(times, 'pickup_requested', now);
  await supabaseAdmin()
    .from('orders')
    .update({ status: 'pickup_requested', pickup_requested_at: now, updated_at: now, status_times: times })
    .eq('id', id)
    .eq('printer_id', printer.id);
  revalidatePath('/printer');
  revalidatePath(`/printer/orders/${id}`);
  revalidatePath('/admin');
}
