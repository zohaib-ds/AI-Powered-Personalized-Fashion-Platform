import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TEST_COOKIE, testUntil } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

// tells the studio and cart whether to offer the ₹1 test size in this browser
export async function GET() {
  const until = await testUntil((await cookies()).get(TEST_COOKIE)?.value);
  return NextResponse.json({ on: until > 0 }, { headers: { 'cache-control': 'no-store' } });
}
