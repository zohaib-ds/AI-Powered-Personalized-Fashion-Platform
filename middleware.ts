import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, adminCookieOptions, adminToken, adminTokenValid } from '@/lib/admin-session';

// Guards /admin. Every request while signed in pushes the 10-minute idle limit forward.
// Opening /admin/login always signs out first.
export async function middleware(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) return new NextResponse('Set ADMIN_PASSWORD in Vercel to use the admin page.', { status: 503 });
  if (req.nextUrl.pathname === '/admin/login') {
    const res = NextResponse.next();
    res.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions, maxAge: 0 });
    return res;
  }
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!(await adminTokenValid(token))) {
    if (req.method !== 'GET') return new NextResponse('Signed out. Open /admin/login to sign in again.', { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = token ? '?expired=1' : '';
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.cookies.set(ADMIN_COOKIE, await adminToken(), adminCookieOptions);
  return res;
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
