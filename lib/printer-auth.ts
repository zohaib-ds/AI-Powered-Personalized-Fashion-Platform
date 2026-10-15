import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin, type PrinterRow } from './supabase-server';

// Print partners sign in at /printer with the access code the admin gave them.
// The session is a signed cookie holding their printer id.
const COOKIE = 'ws_printer';

function secret() {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('Set ADMIN_PASSWORD to use the printer portal.');
  return 'wearsketch-printer:' + s;
}
const sign = (id: string) => createHmac('sha256', secret()).update(id).digest('base64url');

export async function startPrinterSession(id: string) {
  (await cookies()).set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/printer', maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endPrinterSession() {
  (await cookies()).set(COOKIE, '', { path: '/printer', maxAge: 0 });
}

export async function currentPrinter(): Promise<PrinterRow | null> {
  const raw = (await cookies()).get(COOKIE)?.value ?? '';
  const [id, sig] = raw.split('.');
  if (!id || !sig) return null;
  const want = Buffer.from(sign(id));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const { data } = await supabaseAdmin().from('printers').select('*').eq('id', id).eq('active', true).maybeSingle();
  return (data as PrinterRow | null) ?? null;
}
