import type { Metadata, Viewport } from 'next';
import { BRAND } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRAND.name} · Design your tee in 3D`,
  description: BRAND.tagline,
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Print fonts are loaded by family name so the canvas can draw them.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&family=Anton&family=Bebas+Neue&family=Permanent+Marker&family=Pacifico&family=Archivo+Black&family=Playfair+Display:ital,wght@1,700&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
