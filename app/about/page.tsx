import Link from 'next/link';
import Contact from '@/components/Contact';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';
import { COLOURS, SIZES, ZONE_INFO } from '@/lib/design';
import { PRICES, rupee } from '@/lib/pricing';

export const metadata = {
  title: `About ${BRAND.name} · Custom T-shirts designed in 3D`,
  description: `${BRAND.name} lets you design your own T-shirt on a 3D model and have it printed and delivered. Who we are, how an order is made, prices and our promises.`,
  alternates: { canonical: '/about' },
};

const D = PRICES.delivery;

export default function About() {
  const sizes = SIZES.map((s) => s.label);
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow prose">
        <p className="eyebrow">About</p>
        <h1>About {BRAND.name}</h1>
        <p className="lead">{BRAND.name} is a small team that makes custom T-shirts. You design your shirt on a 3D model in your browser, and we print it and deliver it to your door. Every shirt is printed for one order, even if you order just one.</p>

        <h2>Why we started</h2>
        <p>Ordering a custom shirt usually means sending a picture to a print shop and hoping it comes out the way you pictured it. We wanted you to see the real result before you pay. So we built a studio around a 3D model of the exact shirt we print. You can turn it around, see your design on the front, back and sleeves, and only order once it looks right.</p>

        <h2>How your shirt is made</h2>
        <ol className="about-steps">
          <li><strong>You design it.</strong> In the <Link href="/studio">studio</Link> you add text, upload a picture or draw with the pencil. The dashed boxes on the shirt are the exact areas we print: the front ({ZONE_INFO.front.wCm} × {ZONE_INFO.front.hCm} cm), the back ({ZONE_INFO.back.wCm} × {ZONE_INFO.back.hCm} cm) and each sleeve ({ZONE_INFO.sleeveL.wCm} × {ZONE_INFO.sleeveL.hCm} cm).</li>
          <li><strong>We make the print files.</strong> When you order, the studio turns each printed area into a 300 DPI file at its real size, so the print matches what you saw.</li>
          <li><strong>A local print partner prints it.</strong> We work with print shops close to where we deliver. They get your files, print your shirt and pack it.</li>
          <li><strong>A courier brings it to you.</strong> Your order page shows every step, from printing to delivery, with the tracking number once the parcel leaves.</li>
        </ol>

        <h2>What you can order</h2>
        <p>One tee in {COLOURS.length} colours, in sizes {sizes.join(', ')}. Every size costs the same. The price only depends on how many areas you print:</p>
        <table className="kv about-prices"><tbody>
          {PRICES.byAreas.map((p, i) => <tr key={i}><td>{i + 1} printed area{i ? 's' : ''}</td><td>{rupee(p)} per shirt</td></tr>)}
          <tr><td>Delivery</td><td>{rupee(D.base)} for up to {D.perShirts} shirts, then {rupee(D.step)} more for every {D.perShirts} shirts</td></tr>
        </tbody></table>
        <p>You can put up to {PRICES.maxItems} designs in one order and pay one delivery fee for all of them.</p>

        <h2>What we promise</h2>
        <ul>
          <li>You see the full price, delivery included, before you pay.</li>
          <li>You can cancel for a full refund until printing starts.</li>
          <li>If we get something wrong, such as a misprint, a stain or the wrong size, tell us within 3 days of delivery with a photo and your unboxing video. We print it again for free or refund you. See our <Link href="/policies">reprint policy</Link>.</li>
          <li>Your designs are used only to make your order. See our <Link href="/privacy">privacy policy</Link>.</li>
        </ul>

        <h2>Where we deliver</h2>
        <p>We are starting with one city and adding more as we find good print partners. You can design from anywhere, and the checkout shows where we deliver before you enter your address.</p>

        <h2>Talk to us</h2>
        <p>For a question about an order, an order for a team or an event, or anything else, reach us through <Contact />.{BRAND.email ? <> Many answers are already on our <Link href="/help">Help page</Link>.</> : null}</p>

        <p><Link href="/studio" className="btn primary big">Open the studio</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
