'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, adminCookieOptions, adminToken, sameText } from '@/lib/admin-session';

export async function adminLogin(_prev: string | null, form: FormData): Promise<string | null> {
  const password = String(form.get('password') || '');
  const want = process.env.ADMIN_PASSWORD ?? '';
  if (!want) return 'Set ADMIN_PASSWORD in Vercel first.';
  if (!sameText(password, want)) {
    await new Promise((r) => setTimeout(r, 600));
    return 'That password is not right.';
  }
  (await cookies()).set(ADMIN_COOKIE, await adminToken(), adminCookieOptions);
  redirect('/admin');
}
