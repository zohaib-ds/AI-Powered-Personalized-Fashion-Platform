import type { Metadata, Viewport } from 'next';
import { BRAND } from '@/lib/brand';
import { siteUrl } from '@/lib/site';
import './globals.css';

const DESCRIPTION = `${BRAND.name}: design your own custom T-shirt on a 3D model. Draw, add text or upload an image on the front, back and sleeves. We print it and deliver it to your door. No minimum order.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: `${BRAND.name} · Design your own custom T-shirt in 3D`,
  description: DESCRIPTION,
  applicationName: BRAND.name,
  keywords: [BRAND.name, 'WearSketch India', 'custom T-shirt', 'design your own T-shirt', 'T-shirt printing', '3D T-shirt design', 'personalised T-shirt'],
  openGraph: {
    type: 'website', locale: 'en_IN', siteName: BRAND.name, title: `${BRAND.name} · Design your own custom T-shirt in 3D`, description: DESCRIPTION,
    images: [{ url: '/logo.png', width: 1280, height: 1229, alt: BRAND.name }],
  },
  twitter: { card: 'summary', title: BRAND.name, description: DESCRIPTION, images: ['/logo.png'] },
  // the code from Google Search Console > Add property > HTML tag, set as GOOGLE_SITE_VERIFICATION in Vercel
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3efe7',
};

// UI fonts (Archivo, IBM Plex Mono) plus the print fonts, loaded by family name so the canvas can draw them.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,700&family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Mono:wght@400;500;700&display=swap';

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
