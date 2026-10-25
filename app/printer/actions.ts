'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isMobile, mobileDigits } from '@/lib/design';
import { merchantMoney } from '@/lib/payouts';
import { checkPassword, currentPrinter, endPrinterSession, startPrinterSession } from '@/lib/printer-auth';
import { addPickupAddress, bookShipment, shiprocketOn } from '@/lib/shiprocket';
import { payTo, stampStatus, supabaseAdmin, type OrderRow, type PayoutRow, type PrinterRow } from '@/lib/supabase-server';

const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const field = (form: FormData, k: string, max: number) => String(form.get(k) || '').trim().replace(/\s+/g, ' ').slice(0, max);

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

// "Printing done, request pickup": the order is ready to be collected. When Shiprocket is set up,
// the order is sent there too (and in live mode the courier and pickup are booked).
export async function requestPickup(form: FormData) {
  const printer = await currentPrinter();
  if (!printer) redirect('/printer');
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).eq('printer_id', printer.id).maybeSingle();
  const order = data as OrderRow | null;
  if (!order || !['paid', 'sent_to_printer', 'printed'].includes(order.status)) return;
  const now = new Date().toISOString();
  let times = stampStatus(order.status_times, 'sent_to_printer', now);
  times = stampStatus(times, 'printed', now);
  times = stampStatus(times, 'pickup_requested', now);
  const shiprocket = shiprocketOn() ? await bookShipment(order, printer) : null;
  await db
    .from('orders')
    .update({
      status: 'pickup_requested', pickup_requested_at: now, updated_at: now, status_times: times,
      ...(shiprocket ? { shiprocket } : {}),
      ...(shiprocket?.awb ? { tracking: shiprocket.awb } : {}),
    })
    .eq('id', id)
    .eq('printer_id', printer.id);
  revalidatePath('/printer');
  revalidatePath('/admin');
}

export type FormResult = { ok?: string; error?: string; values?: Record<string, string> } | null;

// Pickup address and where to send the merchant's money.
export async function saveAccount(_prev: FormResult, form: FormData): Promise<FormResult> {
  const printer = await currentPrinter();
  if (!printer) redirect('/printer');
  const phone = mobileDigits(String(form.get('phone') || ''));
  const address = field(form, 'address', 200);
  const city = field(form, 'city', 60) || 'Delhi';
  const pincode = field(form, 'pincode', 6);
  const accountName = field(form, 'account_name', 120);
  const accountNumber = field(form, 'account_number', 20).replace(/\s/g, '');
  const ifsc = field(form, 'ifsc', 11).toUpperCase();
  const upi = field(form, 'upi_id', 80).toLowerCase();
  // the form clears after it is sent, so a refusal hands back what was typed
  const values = Object.fromEntries(['phone', 'address', 'city', 'pincode', 'account_name', 'account_number', 'ifsc', 'upi_id'].map((k) => [k, String(form.get(k) || '')]));
  const refuse = (error: string): FormResult => ({ error, values });

  if (!isMobile(phone)) return refuse('Enter a 10 digit mobile number.');
  if (address.length < 10) return refuse('Enter the full shop address: shop or house number, street and area.');
  if (!/^\d{6}$/.test(pincode)) return refuse('Enter the 6 digit pincode.');
  const hasBank = !!(accountName || accountNumber || ifsc);
  if (hasBank && !/^\d{9,18}$/.test(accountNumber)) return refuse('The bank account number should be 9 to 18 digits.');
  if (hasBank && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return refuse('The IFSC code looks wrong. It has 11 characters, like SBIN0001234.');
  if (hasBank && !accountName) return refuse('Enter the name on the bank account.');
  if (upi && !/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/.test(upi)) return refuse('The UPI ID looks wrong. It looks like name@bank.');
  if (!hasBank && !upi) return refuse('Add a UPI ID or bank account so we can pay you.');

  const update = {
    phone, address, city, pincode,
    account_name: accountName || null, account_number: accountNumber || null, ifsc: ifsc || null, upi_id: upi || null,
  };
  const { error } = await supabaseAdmin().from('printers').update(update).eq('id', printer.id);
  if (error) return refuse(`Could not save: ${error.message}`);
  revalidatePath('/printer');
  const moved = printer.address !== address || printer.pincode !== pincode || printer.phone !== phone;
  if (moved && shiprocketOn()) {
    const problem = await addPickupAddress({ ...printer, ...update });
    if (problem) return { ok: 'Saved.', error: `The courier company did not accept this pickup address yet: ${problem}. The WearSketch team will sort it out.` };
  }
  return { ok: 'Saved.' };
}

// Asks WearSketch to pay out everything earned on delivered orders. Once every 5 days.
export async function requestWithdrawal(_prev: FormResult, _form: FormData): Promise<FormResult> {
  const printer = await currentPrinter();
  if (!printer) redirect('/printer');
  const to = payTo(printer);
  if (!to) return { error: 'Add your UPI ID or bank account under Account first.' };
  const db = supabaseAdmin();
  const [{ data: od }, { data: yd }] = await Promise.all([
    db.from('orders').select('status,printer_cost').eq('printer_id', printer.id).eq('status', 'delivered'),
    db.from('payouts').select('amount,status,created_at').eq('printer_id', printer.id),
  ]);
  const money = merchantMoney((od ?? []) as Pick<OrderRow, 'status' | 'printer_cost'>[], (yd ?? []) as Pick<PayoutRow, 'amount' | 'status' | 'created_at'>[]);
  if (money.available <= 0) return { error: 'There is nothing to withdraw yet.' };
  if (!money.canNow) return { error: 'You can withdraw once every 5 days.' };
  const { error } = await db.from('payouts').insert({ printer_id: printer.id, printer_name: printer.name, amount: money.available, pay_to: to });
  if (error) return { error: `Could not send the request: ${error.message}` };
  revalidatePath('/printer');
  revalidatePath('/admin');
  return { ok: 'Request sent. WearSketch will pay you and it will show as paid here.' };
}
