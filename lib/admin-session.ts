// The admin signs in at /admin/login with ADMIN_PASSWORD. The session is a signed cookie that
// ends after 10 minutes without activity. Uses Web Crypto so it also runs in middleware.
export const ADMIN_COOKIE = 'ws_admin';
export const ADMIN_IDLE_MS = 10 * 60 * 1000;

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode('wearsketch-admin:' + (process.env.ADMIN_PASSWORD ?? '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// a new session value that is good for the next 10 minutes
export async function adminToken(now = Date.now()): Promise<string> {
  const until = String(now + ADMIN_IDLE_MS);
  return `${until}.${await hmac(until)}`;
}

export async function adminTokenValid(value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD || !value) return false;
  const [until, sig] = value.split('.');
  if (!/^\d+$/.test(until ?? '') || !sig || Number(until) <= now) return false;
  return sameText(sig, await hmac(until));
}

export const adminCookieOptions = {
  httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/admin', maxAge: ADMIN_IDLE_MS / 1000,
};
