// The site's public address, for search engines and link previews. Set SITE_URL in Vercel once
// the custom domain is live; until then Vercel's own production address is used.
export function siteUrl(): string {
  const set = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return (set || 'http://localhost:3000').replace(/\/+$/, '');
}
