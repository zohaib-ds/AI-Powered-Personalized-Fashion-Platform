// Called by the admin page while someone is using it, so the 10-minute idle sign-out
// only happens when nobody touches the page. Middleware does the actual refresh.
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
