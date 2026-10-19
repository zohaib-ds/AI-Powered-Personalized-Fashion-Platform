import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';
import { COLOURS } from '@/lib/design';

export const metadata = { title: `About · ${BRAND.name}` };

export default function About() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow prose">
        <p className="eyebrow">About</p>
        <h1>About {BRAND.name}</h1>
        <p className="lead">{BRAND.name} is a small team that makes custom T-shirts for people in {BRAND.city}.</p>
        <p>We built a design studio around a 3D model of the shirt we print, so you can see your design on the front, back and sleeves before you order. The dashed boxes in the studio are the exact areas we print.</p>
        <p>When you order, the studio turns your design into a 300 DPI print file for each area. One of our print partners in {BRAND.city} prints the shirt, and Ekart delivers it. Your order page shows each step, and any review you leave is shown to the print partner who made your shirt.</p>
        <p>Right now we offer one free-size tee in {COLOURS.length} colours and deliver only in {BRAND.city}.</p>
        <p><Link href="/studio" className="btn primary big">Open the studio</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
