'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentPrinter, endPrinterSession, startPrinterSession } from '@/lib/printer-auth';
import { PRINTER_STATUSES, supabaseAdmin, type OrderStatus } from '@/lib/supabase-server';

export async function printerLogin(_prev: string | null, form: FormData): Promise<string | null> {
  const code = String(form.get('code') || '').trim().toUpperCase();
  if (!code) return 'Enter your access code.';
  const { data } = await supabaseAdmin().from('printers').select('id').eq('access_code', code).eq('active', true).maybeSingle();
  if (!data) return 'That code did not work. Check it with the WearSketch team.';
  await startPrinterSession(data.id);
  redirect('/printer');
}

export async function printerLogout() {
  await endPrinterSession();
  redirect('/printer');
}

// A printer moves their own order along: printing, printed, shipped (with Ekart tracking), delivered.
export async function printerUpdate(form: FormData) {
  const printer = await currentPrinter();
  if (!printer) redirect('/printer');
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '') as OrderStatus;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !PRINTER_STATUSES.includes(status)) return;
  const tracking = String(form.get('tracking') || '').trim().slice(0, 120) || null;
  const note = String(form.get('printer_note') || '').trim().slice(0, 1000) || null;
  await supabaseAdmin()
    .from('orders')
    .update({ status, tracking, printer_note: note, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('printer_id', printer.id);
  revalidatePath('/printer');
  revalidatePath(`/printer/orders/${id}`);
}
