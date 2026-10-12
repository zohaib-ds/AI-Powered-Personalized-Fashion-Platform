import { NextResponse, type NextRequest } from 'next/server';

// Password-protects /admin with HTTP basic auth (any username, ADMIN_PASSWORD).
export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse('Set ADMIN_PASSWORD to use the admin page.', { status: 503 });
  const header = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = atob(encoded);
    if (decoded.slice(decoded.indexOf(':') + 1) === password) return NextResponse.next();
  }
  return new NextResponse('Admin login required.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="admin"' } });
}

export const config = { matcher: ['/admin/:path*'] };
