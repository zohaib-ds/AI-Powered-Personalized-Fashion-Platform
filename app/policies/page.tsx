import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';

export const metadata = { title: 'Policies · WearSketch' };

export default function Policies() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow prose">
        <p className="eyebrow">Policies</p>
        <h1>Shipping, reprints and privacy</h1>
        <p className="muted">These are plain-language policies for our launch in {BRAND.city}. Last updated October 2026.</p>

        <h2 id="shipping">Shipping</h2>
        <p>We deliver within {BRAND.city} (pincodes starting with 110) through Ekart. Each shirt is printed to order by one of our Delhi print partners, then handed to Ekart. Your order page shows each step and the Ekart tracking number once it ships.</p>

        <h2 id="reprints">Reprints and refunds</h2>
        <p>Every shirt is made just for you, so we cannot take back a shirt because you changed your mind about the design.</p>
        <p>If something is wrong on our side, such as a misprint, a print in the wrong place, a stain or a damaged shirt, tell us within 7 days of delivery with a photo and your order number. We will reprint it for free or refund you.</p>
        <p>You can cancel for a full refund until the printer starts on your order.</p>

        <h2 id="designs">Your designs</h2>
        <p>Only upload images and text you have the right to use. We do not print hateful content or other people&apos;s trademarks or artwork without permission, and we may cancel and refund such orders.</p>

        <h2 id="privacy">Privacy</h2>
        <p>We collect your name, phone, address and email only to make and deliver your order. We share your delivery details with the print partner making your shirt and with Ekart. Your print files are stored privately and seen only by our team and that print partner. We do not sell your data.</p>
        <p>Your design is also saved in your own browser so you can come back to it. Clearing your browser data removes it.</p>

        <h2 id="payments">Payments</h2>
        <p>Checkout is in test mode while we set up our payment partner. No money is taken yet.</p>
      </main>
      <SiteFooter />
    </>
  );
}
