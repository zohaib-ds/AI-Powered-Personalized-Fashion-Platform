import type { Metadata, Viewport } from 'next';
import { BRAND } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRAND.name} · Design your own T-shirt in 3D`,
  description: 'Sketch, type or upload on a real 3D shirt. Printed in Delhi, one piece, no minimum, delivered by Ekart.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#eceef3' }, { media: '(prefers-color-scheme: dark)', color: '#12141a' }],
};

// UI fonts plus the print fonts, loaded by family name so the canvas can draw them.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,700&family=Space+Mono:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Instrument+Sans:wght@400;500;600;700&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
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
