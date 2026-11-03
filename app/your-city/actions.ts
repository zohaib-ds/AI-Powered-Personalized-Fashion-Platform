'use server';

import { supabaseAdmin } from '@/lib/supabase-server';

export type CityResult = { ok?: boolean; error?: string; values?: Record<string, string> } | null;

const field = (form: FormData, k: string, max: number) => String(form.get(k) || '').trim().replace(/\s+/g, ' ').slice(0, max);

// "Want it in your city?": saved for the admin, who sees it under City requests.
export async function sendCityRequest(_prev: CityResult, form: FormData): Promise<CityResult> {
  const values = Object.fromEntries(['city', 'why', 'liked', 'email'].map((k) => [k, String(form.get(k) || '')]));
  if (form.get('website')) return { ok: true }; // a field people never see, filled only by spam bots
  const city = field(form, 'city', 80);
  const why = field(form, 'why', 600);
  const liked = field(form, 'liked', 600);
  const email = field(form, 'email', 160).toLowerCase();
  if (city.length < 2) return { error: 'Tell us which city you are in.', values };
  if (!why) return { error: 'Tell us why you want WearSketch in your city.', values };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email address looks wrong. Check it, or leave it empty.', values };
  const { error } = await supabaseAdmin().from('city_requests').insert({ city, why, liked: liked || null, email: email || null });
  if (error) return { error: 'Could not send it. Please try again.', values };
  return { ok: true };
}
