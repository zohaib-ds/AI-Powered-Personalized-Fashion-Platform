'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, adminTokenValid, TEST_COOKIE, testCookieOptions, testToken } from '@/lib/admin-session';
import { giveToMerchant } from '@/lib/auto-assign';
import { isMobile, mobileDigits } from '@/lib/design';
import { hashPassword, openPassword, sealPassword } from '@/lib/printer-auth';
import { UTR_MISSING, UTR_SENT } from '@/lib/payments';
import { bookShipment, icarryOn, registerPickup } from '@/lib/icarry';
import { sendOrderMail, sendTestMail } from '@/lib/mail';
import { ISSUE_LABEL, stampStatus, STATUS_LABEL, supabaseAdmin, type OrderRow, type OrderStatus, type PrinterRow } from '@/lib/supabase-server';

// Only reachable from /admin, which middleware guards. Each action checks the session again.
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const text = (form: FormData, k: string, max: number) => String(form.get(k) || '').trim().slice(0, max) || null;

async function requireAdmin() {
  if (!(await adminTokenValid((await cookies()).get(ADMIN_COOKIE)?.value))) throw new Error('Signed out. Open /admin/login to sign in again.');
}

export type MailResult = { ok?: string; error?: string } | null;
export async function testEmail(_prev: MailResult, _form: FormData): Promise<MailResult> {
  await requireAdmin();
  return sendTestMail();
}

// the ₹1 test size, in this browser only, for one hour
export async function startPaymentTest() {
  await requireAdmin();
  (await cookies()).set(TEST_COOKIE, await testToken(), testCookieOptions);
  revalidatePath('/admin');
}
export async function stopPaymentTest() {
  await requireAdmin();
  (await cookies()).set(TEST_COOKIE, '', { ...testCookieOptions, maxAge: 0 });
  revalidatePath('/admin');
}

export async function updateOrder(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '') as OrderStatus;
  if (!isId(id) || !(status in STATUS_LABEL)) return;
  const printerId = String(form.get('printer_id') || '');
  const issue = String(form.get('issue') || '');
  const refund = Math.round(Number(form.get('refund_amount') || 0));
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).single();
  const before = data as OrderRow | null;
  if (!before) return;
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
  // the same emails and hand-over as the To do buttons, when an unpaid order is confirmed or cancelled here
  if (before.status === 'pending_payment' && status === 'paid') {
    await giveToMerchant(id);
    await sendOrderMail('confirmed', before);
  }
  if (before.status === 'pending_payment' && status === 'cancelled') await sendOrderMail('cancelled', before);
  revalidatePath('/admin');
  revalidatePath(`/order/${id}`);
}

export interface Credentials { name: string; loginId: string; password: string }
// a refusal hands back what was typed, because the form clears after it is sent
export type Typed = Record<string, string>;
export type CredentialsResult = Credentials | { error: string; values?: Typed } | null;
const typed = (form: FormData, keys: string[]): Typed => Object.fromEntries(keys.map((k) => [k, String(form.get(k) || '')]));

// Turns a database error into a line the admin can act on.
function saveError(e: { code?: string; message?: string }) {
  if (e.code === '42703' || e.code === 'PGRST204' || /column/i.test(e.message ?? '')) {
    return 'The database is missing the login columns. In Supabase, open SQL Editor, paste all of supabase/schema.sql and click Run, then try again.';
  }
  return `Could not save: ${e.message ?? 'unknown database error'}`;
}

// /printer turns what the merchant types into capitals, so login IDs are saved in capitals.
const loginOf = (form: FormData) => String(form.get('login_id') || '').trim().toUpperCase();
const loginProblem = (id: string) =>
  /^[A-Z0-9-]{4,30}$/.test(id) ? null : 'The login ID can use letters, numbers and dashes (no spaces), 4 to 30 characters, for example YADAV-01.';
const passwordProblem = (pw: string) => (pw.length >= 6 && pw.length <= 64 ? null : 'The password needs 6 to 64 characters.');
const takenOrSaveError = (e: { code?: string; message?: string }) =>
  e.code === '23505' ? 'Another merchant already has that login ID. Pick a different one.' : saveError(e);

// Adds a merchant with the login ID and password the admin types. Sign in checks a hash of the
// password; a locked copy lets the admin see it again under Show password.
export async function createPrinter(_prev: CredentialsResult, form: FormData): Promise<CredentialsResult> {
  await requireAdmin();
  const values = typed(form, ['name', 'area', 'phone', 'login_id', 'password']);
  const name = text(form, 'name', 120);
  const loginId = loginOf(form);
  const password = String(form.get('password') || '');
  if (!name) return { error: 'Type the merchant name first.', values };
  const problem = loginProblem(loginId) ?? passwordProblem(password);
  if (problem) return { error: problem, values };
  const { data: made, error } = await supabaseAdmin().from('printers').insert({
    name, area: text(form, 'area', 120), phone: text(form, 'phone', 20), access_code: loginId, login_id: loginId, password_hash: hashPassword(password),
  }).select('id').single();
  if (error) return { error: takenOrSaveError(error), values };
  await keepPassword(made.id, password);
  revalidatePath('/admin');
  return { name, loginId, password };
}

// Saved apart from the insert, so a database that has not had schema.sql re-run still adds merchants;
// the admin page then says the password was not kept.
async function keepPassword(id: string, password: string) {
  await supabaseAdmin().from('printers').update({ password_enc: sealPassword(password) }).eq('id', id);
}

// Changes a merchant's login ID, and their password when one is typed (a new password signs them out everywhere).
export async function setPrinterLogin(_prev: CredentialsResult, form: FormData): Promise<CredentialsResult> {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return { error: 'Merchant not found.' };
  const values = typed(form, ['login_id', 'password']);
  const loginId = loginOf(form);
  const password = String(form.get('password') || '');
  const problem = loginProblem(loginId) ?? (password ? passwordProblem(password) : null);
  if (problem) return { error: problem, values };
  const db = supabaseAdmin();
  const { data, error: readError } = await db.from('printers').select('*').eq('id', id).maybeSingle();
  if (readError) return { error: saveError(readError), values };
  const p = data as PrinterRow | null;
  if (!p) return { error: 'Merchant not found.' };
  if (!password && !p.password_hash) return { error: 'This merchant has no password yet. Type one.', values };
  const { error } = await db.from('printers').update({
    login_id: loginId, access_code: loginId,
    ...(password ? { password_hash: hashPassword(password) } : {}),
  }).eq('id', id);
  if (error) return { error: takenOrSaveError(error), values };
  if (password) await keepPassword(id, password);
  revalidatePath('/admin');
  return { name: p.name, loginId, password: password || openPassword(p.password_enc) || 'not changed' };
}

export type DetailsResult = { ok?: string; error?: string; values?: Typed } | null;

// The merchant's pickup address and UPI ID, typed by the admin (the merchant can also change them under Account).
export async function savePrinterDetails(_prev: DetailsResult, form: FormData): Promise<DetailsResult> {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return { error: 'Merchant not found.' };
  const values = typed(form, ['address', 'city', 'pincode', 'phone', 'upi_id']);
  const refuse = (error: string): DetailsResult => ({ error, values });
  const one = (k: string, max: number) => String(form.get(k) || '').trim().replace(/\s+/g, ' ').slice(0, max);
  const phone = mobileDigits(one('phone', 20));
  const address = one('address', 200);
  const city = one('city', 60) || 'Delhi';
  const pincode = one('pincode', 6);
  const upi = one('upi_id', 80).toLowerCase();
  if (phone && !isMobile(phone)) return refuse('Enter a 10 digit mobile number, or leave it empty.');
  if (address && address.length < 10) return refuse('Enter the full shop address: shop or house number, street and area.');
  if (pincode && !/^\d{6}$/.test(pincode)) return refuse('Enter the 6 digit pincode.');
  if (address && !pincode) return refuse('Enter the 6 digit pincode with the address.');
  if (upi && !/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/.test(upi)) return refuse('The UPI ID looks wrong. It looks like name@bank.');
  const db = supabaseAdmin();
  const { data } = await db.from('printers').select('*').eq('id', id).maybeSingle();
  const p = data as PrinterRow | null;
  if (!p) return { error: 'Merchant not found.' };
  const update = { phone: phone || null, address: address || null, city: address ? city : null, pincode: pincode || null, upi_id: upi || null };
  const { error } = await db.from('printers').update(update).eq('id', id);
  if (error) return refuse(saveError(error));
  revalidatePath('/admin');
  revalidatePath('/printer');
  const moved = (p.address ?? null) !== update.address || (p.pincode ?? null) !== update.pincode || (p.phone ?? null) !== update.phone;
  // a new address becomes a new iCarry pickup address
  if (moved && update.address && icarryOn()) {
    const problem = await registerPickup({ ...p, ...update });
    if (problem) return { ok: 'Saved.', error: `iCarry did not accept this pickup address yet: ${problem}`, values };
  }
  return { ok: 'Saved.', values };
}

export async function setPrinterActive(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  await supabaseAdmin().from('printers').update({ active: form.get('active') === 'true' }).eq('id', id);
  revalidatePath('/admin');
}

export async function setReviewPublic(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  await supabaseAdmin().from('reviews').update({ show_on_site: form.get('show') === 'true' }).eq('id', id);
  revalidatePath('/admin');
  revalidatePath('/');
}

// Gives a paid order to a merchant from the To do list.
export async function assignOrder(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  const printerId = String(form.get('printer_id') || '');
  if (!isId(id) || !isId(printerId)) return;
  const db = supabaseAdmin();
  // the order stays Confirmed and shows under New orders on the merchant's page
  await db.from('orders').update({ printer_id: printerId, updated_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin');
}

// One-tap moves from the To do list: shipped (with its tracking number) once the courier has
// the parcel, then delivered. Delivered orders count towards what the merchant can withdraw.
export async function markShipped(form: FormData) {
  await moveOrder(form, 'shipped');
}

export async function markDelivered(form: FormData) {
  await moveOrder(form, 'delivered');
}

async function moveOrder(form: FormData, status: 'shipped' | 'delivered') {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('status_times').eq('id', id).single();
  if (!data) return;
  const now = new Date().toISOString();
  await db.from('orders').update({
    status, updated_at: now, status_times: stampStatus((data as Pick<OrderRow, 'status_times'>).status_times, status, now),
    ...(status === 'shipped' ? { tracking: text(form, 'tracking', 120) } : {}),
  }).eq('id', id);
  revalidatePath('/admin');
}

// Tries iCarry again for an order whose courier booking did not go through.
export async function retryCourier(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('*').eq('id', id).single();
  const order = o as OrderRow | null;
  if (!order?.printer_id) return;
  const { data: p } = await db.from('printers').select('*').eq('id', order.printer_id).single();
  if (!p) return;
  const info = await bookShipment(order, p as PrinterRow);
  await db.from('orders').update({ shiprocket: info, ...(info.awb ? { tracking: info.awb } : {}), updated_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin');
}

// Removes a merchant. Their open orders go back to "not assigned"; past orders and payouts keep their numbers.
export async function deletePrinter(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  await db.from('orders').update({ status: 'paid', printer_id: null, updated_at: now }).eq('printer_id', id).in('status', ['paid', 'sent_to_printer', 'printed']);
  await db.from('printers').delete().eq('id', id);
  revalidatePath('/admin');
}

// The merchant's iCarry pickup address ID, if it was made in the iCarry panel instead of from here.
export async function setPickupId(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const pickup = String(form.get('pickup_id') || '').replace(/\D/g, '').slice(0, 12);
  await supabaseAdmin().from('printers').update({ shiprocket_pickup: pickup || null }).eq('id', id);
  revalidatePath('/admin');
}

// A withdrawal the admin has paid (with the bank or UPI reference) or turned down.
export async function payoutPaid(form: FormData) {
  await settlePayout(form, 'paid');
}

export async function payoutRejected(form: FormData) {
  await settlePayout(form, 'rejected');
}

async function settlePayout(form: FormData, status: 'paid' | 'rejected') {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  await supabaseAdmin().from('payouts')
    .update({ status, reference: text(form, 'reference', 120), paid_at: status === 'paid' ? new Date().toISOString() : null })
    .eq('id', id).eq('status', 'requested');
  revalidatePath('/admin');
}

// A UPI payment the customer reported: the admin found it in the bank app, or could not find it.
export async function paymentReceived(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).single();
  const o = data as OrderRow | null;
  if (!o || o.status !== 'pending_payment') return;
  const now = new Date().toISOString();
  const { data: moved } = await db.from('orders').update({ status: 'paid', updated_at: now, status_times: stampStatus(o.status_times, 'paid', now) })
    .eq('id', id).eq('status', 'pending_payment').select('id');
  if (!moved?.length) return; // confirmed already, by another tap
  await giveToMerchant(id);
  await sendOrderMail('confirmed', o);
  revalidatePath('/admin');
  revalidatePath(`/order/${id}`);
}

// No payment came for this order: cancel it and tell the customer.
export async function cancelUnpaid(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).single();
  const o = data as OrderRow | null;
  if (!o || o.status !== 'pending_payment') return;
  const now = new Date().toISOString();
  const { data: moved } = await db.from('orders').update({ status: 'cancelled', updated_at: now, status_times: stampStatus(o.status_times, 'cancelled', now) })
    .eq('id', id).eq('status', 'pending_payment').select('id');
  if (!moved?.length) return;
  await sendOrderMail('cancelled', o);
  revalidatePath('/admin');
  revalidatePath(`/order/${id}`);
}

export async function paymentMissing(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || '');
  if (!isId(id)) return;
  const db = supabaseAdmin();
  const { data } = await db.from('orders').select('*').eq('id', id).single();
  const o = data as OrderRow | null;
  if (!o || o.status !== 'pending_payment' || !o.payment_ref?.startsWith(UTR_SENT)) return;
  // the order page asks the customer to check the number and send it again, and we email them
  await db.from('orders').update({ payment_ref: UTR_MISSING + o.payment_ref.slice(UTR_SENT.length), updated_at: new Date().toISOString() }).eq('id', id);
  await sendOrderMail('missing', o);
  revalidatePath('/admin');
  revalidatePath(`/order/${id}`);
}
