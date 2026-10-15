import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { BRAND } from '@/lib/brand';
import { ZONE_INFO } from '@/lib/design';
import { FROM_PRICE, PRICES, rupee } from '@/lib/pricing';

export const metadata = { title: 'Help and FAQ · WearSketch' };

const GROUPS: [string, [string, React.ReactNode][]][] = [
  ['Designing', [
    ['Where can I print?', `On the front (${ZONE_INFO.front.wCm} × ${ZONE_INFO.front.hCm} cm), the back (${ZONE_INFO.back.wCm} × ${ZONE_INFO.back.hCm} cm) and the outside of each sleeve (${ZONE_INFO.sleeveL.wCm} × ${ZONE_INFO.sleeveL.hCm} cm). The sides of the shirt are not printed. The studio shows these areas as dashed boxes.`],
    ['What images work best?', 'A PNG with a transparent background, at least 2000 pixels wide for a full front print. The studio tells you the print quality of every image at the size you chose.'],
    ['Will the colours look exactly like my screen?', 'Very close, but screens glow and fabric does not, so bright neon colours print slightly softer. Dark ink on light shirts and light ink on dark shirts always looks crisp.'],
    ['Is my design saved?', 'Yes, in your browser, automatically. Coming back on the same device brings it back.'],
  ]],
  ['Orders and delivery', [
    ['How much does it cost?', <>Shirts start at {rupee(FROM_PRICE)} with one printed side. Ekart delivery in Delhi is {rupee(PRICES.delivery)} per order. See <Link href="/#pricing">pricing</Link>.</>],
    ['Where do you deliver?', `${BRAND.city} for now, any pincode starting with 110. More cities are coming.`],
    ['What size is the shirt?', 'Every shirt is our free-size, relaxed fit tee for now. More sizes are coming soon.'],
    ['How do I track my order?', <>Your order page updates at every step. Find it any time from <Link href="/track">Track order</Link>.</>],
  ]],
  ['Problems', [
    ['My print came out wrong', <>If there is a printing mistake on our side, we reprint it for free. See the <Link href="/policies">reprint policy</Link>.</>],
    ['Can I cancel?', 'Yes, until the printer starts on it. After that the shirt is made just for you, so it cannot be cancelled.'],
  ]],
];

export default function Help() {
  return (
    <>
      <SiteHeader />
      <main className="wrap page-narrow">
        <p className="eyebrow">Help</p>
        <h1>How can we help?</h1>
        {GROUPS.map(([title, items]) => (
          <section key={title} className="help-group">
            <h2>{title}</h2>
            <div className="faq">
              {items.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
            </div>
          </section>
        ))}
        <section className="card contact">
          <h2>Still stuck?</h2>
          <p className="muted">Tell us your order number and what went wrong.</p>
          <div className="row">
            {BRAND.whatsapp && <a className="btn primary" href={`https://wa.me/${BRAND.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp us</a>}
            {BRAND.email && <a className="btn" href={`mailto:${BRAND.email}`}>{BRAND.email}</a>}
            {!BRAND.whatsapp && !BRAND.email && <span className="muted">Our support number is being set up and will appear here.</span>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
