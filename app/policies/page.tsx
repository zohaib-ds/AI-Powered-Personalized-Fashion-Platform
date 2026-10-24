import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';
import { PRICES, rupee } from '@/lib/pricing';

const D = PRICES.delivery;

export const metadata = { title: `Shipping and reprints · ${BRAND.name}` };

export default function Policies() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow prose">
        <p className="eyebrow">Policies</p>
        <h1>Shipping, cancellations and reprints</h1>
        <p className="updated">Last updated 19 October 2026</p>

        <h2 id="shipping">Shipping</h2>
        <p>We deliver to your door in the areas we serve, which we show at checkout before you pay. Delivery costs {rupee(D.base)} for an order of up to {D.perShirts} shirts, plus {rupee(D.step)} for every further {D.perShirts} shirts. Each shirt is printed to order by our print partner and then handed to our delivery partner. Your order page shows each step, and the tracking number once the parcel ships.</p>

        <h2 id="cancel">Cancellations</h2>
        <p>You can cancel for a full refund until the printer starts on your order. After that the shirt is being made for you and cannot be cancelled.</p>

        <h2 id="reprints">Reprints and refunds</h2>
        <p>Every shirt is made for one customer, so we cannot take a shirt back because you changed your mind about the design.</p>
        <p>If something is wrong on our side, such as a misprint, a print in the wrong place, a stain or a damaged shirt, tell us within 7 days of delivery. Send a photo and your order number. We will reprint it for free or refund you.</p>

        <h2 id="designs">Your designs</h2>
        <p>Only upload images and text you have the right to use. See section 4 of our <Link href="/terms">terms and conditions</Link>.</p>

        <h2 id="privacy">Privacy</h2>
        <p>How we handle your name, phone number and address is explained in our <Link href="/privacy">privacy policy</Link>.</p>
      </main>
      <SiteFooter />
    </>
  );
}
