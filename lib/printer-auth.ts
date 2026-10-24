import 'server-only';
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin, type PrinterRow } from './supabase-server';

// Merchants (print partners) sign in at /printer with the login ID and password
// the admin gave them. The session is a signed cookie holding their printer id.
const COOKIE = 'ws_printer';

function secret() {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('Set ADMIN_PASSWORD to use the merchant portal.');
  return 'wearsketch-printer:' + s;
}
// the signature also covers the password hash, so resetting a password signs that merchant out everywhere
const sign = (id: string, pwHash: string | null) => createHmac('sha256', secret()).update(`${id}:${pwHash ?? ''}`).digest('base64url');

// passwords are stored only as salted scrypt hashes: "scrypt$salt$hash"
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('base64url')}`;
}

export function checkPassword(password: string, stored: string | null): boolean {
  const [kind, salt, hash] = (stored ?? '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64url');
  const got = scryptSync(password, salt, want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PW_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join('');
export const newLoginId = () => 'WS-' + pick(ID_CHARS, 6);
export const newPassword = () => `${pick(PW_CHARS, 4)}-${pick(PW_CHARS, 4)}-${pick(PW_CHARS, 4)}`;

export async function startPrinterSession(p: Pick<PrinterRow, 'id' | 'password_hash'>) {
  (await cookies()).set(COOKIE, `${p.id}.${sign(p.id, p.password_hash)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/printer', maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endPrinterSession() {
  (await cookies()).set(COOKIE, '', { path: '/printer', maxAge: 0 });
}

export async function currentPrinter(): Promise<PrinterRow | null> {
  const raw = (await cookies()).get(COOKIE)?.value ?? '';
  const [id, sig] = raw.split('.');
  if (!/^[0-9a-f-]{36}$/i.test(id ?? '') || !sig) return null;
  const { data } = await supabaseAdmin().from('printers').select('*').eq('id', id).eq('active', true).maybeSingle();
  const p = data as PrinterRow | null;
  if (!p) return null;
  const want = Buffer.from(sign(p.id, p.password_hash));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return p;
}
