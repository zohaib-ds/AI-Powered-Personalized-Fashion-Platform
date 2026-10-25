import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// The public pages, for Google Search Console.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: [string, number][] = [['', 1], ['/studio', 0.9], ['/about', 0.7], ['/help', 0.7], ['/track', 0.4], ['/policies', 0.4], ['/privacy', 0.3], ['/terms', 0.3]];
  return pages.map(([path, priority]) => ({ url: `${base}${path}`, changeFrequency: 'weekly', priority }));
}
