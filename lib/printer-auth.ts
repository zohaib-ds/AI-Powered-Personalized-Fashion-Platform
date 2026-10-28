import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
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

// A locked copy of the password, so the admin can see it again under Merchants.
// AES-GCM with a key made from the Supabase secret key, which only the server has: "gcm$iv$tag$data".
const pwKey = () => createHash('sha256').update('wearsketch-merchant-password:' + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')).digest();

export function sealPassword(password: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', pwKey(), iv);
  const data = Buffer.concat([c.update(password, 'utf8'), c.final()]);
  return ['gcm', iv, c.getAuthTag(), data].map((v) => (typeof v === 'string' ? v : v.toString('base64url'))).join('$');
}

// null when there is no copy, or the secret key changed since it was made
export function openPassword(sealed: string | null | undefined): string | null {
  const [kind, iv, tag, data] = (sealed ?? '').split('$');
  if (kind !== 'gcm' || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', pwKey(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
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
